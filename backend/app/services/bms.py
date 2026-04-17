from __future__ import annotations

import uuid
from datetime import datetime, timezone, timedelta

from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import NotFoundError
from app.models.bms import (
    Building, Floor, Zone, BmsRoom, BmsSensor, BmsSensorReading,
    Equipment, EquipmentCommand, BmsAlert, AutomationRule, AutomationLog,
    BmsAlertStatus, BmsAlertSeverity, BmsAlertType,
    EquipmentStatus, EquipmentCommandType, CommandStatus,
    BmsSensorType, ConditionOperator,
)


# ── Thresholds ───────────────────────────────────────────────────────

BMS_THRESHOLDS: dict[str, dict[str, tuple[float | None, float | None]]] = {
    "TEMPERATURE":      {"WARNING": (18, 28),    "CRITICAL": (15, 32)},
    "HUMIDITY":          {"WARNING": (30, 70),    "CRITICAL": (20, 80)},
    "CO2":              {"WARNING": (None, 1000), "CRITICAL": (None, 1500)},
    "LIGHT":            {"WARNING": (100, 800),   "CRITICAL": (50, 1000)},
    "PIPE_TEMPERATURE": {"WARNING": (5, 80),      "CRITICAL": (0, 95)},
}


def _check_bms_range(key: str, value: float) -> str:
    if key not in BMS_THRESHOLDS:
        return "NORMAL"
    crit = BMS_THRESHOLDS[key].get("CRITICAL")
    warn = BMS_THRESHOLDS[key].get("WARNING")
    if crit:
        lo, hi = crit
        if (lo is not None and value < lo) or (hi is not None and value > hi):
            return "CRITICAL"
    if warn:
        lo, hi = warn
        if (lo is not None and value < lo) or (hi is not None and value > hi):
            return "WARNING"
    return "NORMAL"


def evaluate_bms_severity(sensor_type: str, value: float | None, value_text: str | None = None) -> str:
    """Return NORMAL / WARNING / CRITICAL / EMERGENCY."""
    # SMOKE and WATER_LEAK → always EMERGENCY on detection
    if sensor_type == "SMOKE":
        if value_text and value_text.upper() == "DETECTED":
            return "EMERGENCY"
        if value is not None and value > 0:
            return "EMERGENCY"
        return "NORMAL"
    if sensor_type == "WATER_LEAK":
        if value_text and value_text.upper() == "DETECTED":
            return "EMERGENCY"
        if value is not None and value > 0:
            return "EMERGENCY"
        return "NORMAL"
    if value is None:
        return "NORMAL"
    return _check_bms_range(sensor_type, value)


# ── Condition evaluation helper ──────────────────────────────────────

def _evaluate_condition(operator: str, sensor_value: float, threshold: float) -> bool:
    if operator == "GT":
        return sensor_value > threshold
    if operator == "LT":
        return sensor_value < threshold
    if operator == "GTE":
        return sensor_value >= threshold
    if operator == "LTE":
        return sensor_value <= threshold
    if operator == "EQ":
        return sensor_value == threshold
    return False


# ── Service ──────────────────────────────────────────────────────────

class BmsService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    # ── Buildings ─────────────────────────────────────────────────────

    async def get_buildings(self, clinic_id: uuid.UUID) -> list[Building]:
        query = (
            select(Building)
            .where(Building.clinic_id == clinic_id, Building.is_deleted == False)
            .order_by(Building.name)
        )
        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def create_building(self, clinic_id: uuid.UUID, data: dict) -> Building:
        building = Building(id=uuid.uuid4(), clinic_id=clinic_id, **data)
        self.session.add(building)
        await self.session.flush()
        await self.session.refresh(building)
        return building

    async def update_building(self, building_id: uuid.UUID, clinic_id: uuid.UUID, data: dict) -> Building:
        query = select(Building).where(
            Building.id == building_id, Building.clinic_id == clinic_id, Building.is_deleted == False
        )
        result = await self.session.execute(query)
        building = result.scalar_one_or_none()
        if not building:
            raise NotFoundError("Building", str(building_id))
        for k, v in data.items():
            if v is not None:
                setattr(building, k, v)
        await self.session.flush()
        await self.session.refresh(building)
        return building

    # ── Floors ────────────────────────────────────────────────────────

    async def get_floors(self, building_id: uuid.UUID, clinic_id: uuid.UUID) -> list[Floor]:
        query = (
            select(Floor)
            .where(
                Floor.building_id == building_id,
                Floor.clinic_id == clinic_id,
                Floor.is_deleted == False,
            )
            .order_by(Floor.sort_order, Floor.floor_number)
        )
        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def create_floor(self, clinic_id: uuid.UUID, data: dict) -> Floor:
        floor = Floor(id=uuid.uuid4(), clinic_id=clinic_id, **data)
        self.session.add(floor)
        await self.session.flush()
        await self.session.refresh(floor)
        return floor

    async def update_floor(self, floor_id: uuid.UUID, clinic_id: uuid.UUID, data: dict) -> Floor:
        query = select(Floor).where(
            Floor.id == floor_id, Floor.clinic_id == clinic_id, Floor.is_deleted == False
        )
        result = await self.session.execute(query)
        floor = result.scalar_one_or_none()
        if not floor:
            raise NotFoundError("Floor", str(floor_id))
        for k, v in data.items():
            if v is not None:
                setattr(floor, k, v)
        await self.session.flush()
        await self.session.refresh(floor)
        return floor

    async def delete_floor(self, floor_id: uuid.UUID, clinic_id: uuid.UUID) -> None:
        query = select(Floor).where(
            Floor.id == floor_id, Floor.clinic_id == clinic_id, Floor.is_deleted == False
        )
        result = await self.session.execute(query)
        floor = result.scalar_one_or_none()
        if not floor:
            raise NotFoundError("Floor", str(floor_id))
        floor.is_deleted = True
        await self.session.flush()

    # ── Zones ─────────────────────────────────────────────────────────

    async def get_zones(self, floor_id: uuid.UUID, clinic_id: uuid.UUID) -> list[Zone]:
        query = (
            select(Zone)
            .where(
                Zone.floor_id == floor_id,
                Zone.clinic_id == clinic_id,
                Zone.is_deleted == False,
            )
            .order_by(Zone.name)
        )
        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def create_zone(self, clinic_id: uuid.UUID, data: dict) -> Zone:
        zone = Zone(id=uuid.uuid4(), clinic_id=clinic_id, **data)
        self.session.add(zone)
        await self.session.flush()
        await self.session.refresh(zone)
        return zone

    async def update_zone(self, zone_id: uuid.UUID, clinic_id: uuid.UUID, data: dict) -> Zone:
        query = select(Zone).where(
            Zone.id == zone_id, Zone.clinic_id == clinic_id, Zone.is_deleted == False
        )
        result = await self.session.execute(query)
        zone = result.scalar_one_or_none()
        if not zone:
            raise NotFoundError("Zone", str(zone_id))
        for k, v in data.items():
            if v is not None:
                setattr(zone, k, v)
        await self.session.flush()
        await self.session.refresh(zone)
        return zone

    async def delete_zone(self, zone_id: uuid.UUID, clinic_id: uuid.UUID) -> None:
        query = select(Zone).where(
            Zone.id == zone_id, Zone.clinic_id == clinic_id, Zone.is_deleted == False
        )
        result = await self.session.execute(query)
        zone = result.scalar_one_or_none()
        if not zone:
            raise NotFoundError("Zone", str(zone_id))
        zone.is_deleted = True
        await self.session.flush()

    # ── Rooms ─────────────────────────────────────────────────────────

    async def get_rooms(self, floor_id: uuid.UUID, clinic_id: uuid.UUID) -> list[BmsRoom]:
        query = (
            select(BmsRoom)
            .where(
                BmsRoom.floor_id == floor_id,
                BmsRoom.clinic_id == clinic_id,
                BmsRoom.is_deleted == False,
            )
            .order_by(BmsRoom.name)
        )
        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def create_room(self, clinic_id: uuid.UUID, data: dict) -> BmsRoom:
        room = BmsRoom(id=uuid.uuid4(), clinic_id=clinic_id, **data)
        self.session.add(room)
        await self.session.flush()
        await self.session.refresh(room)
        return room

    async def update_room(self, room_id: uuid.UUID, clinic_id: uuid.UUID, data: dict) -> BmsRoom:
        query = select(BmsRoom).where(
            BmsRoom.id == room_id, BmsRoom.clinic_id == clinic_id, BmsRoom.is_deleted == False
        )
        result = await self.session.execute(query)
        room = result.scalar_one_or_none()
        if not room:
            raise NotFoundError("BmsRoom", str(room_id))
        for k, v in data.items():
            if v is not None:
                setattr(room, k, v)
        await self.session.flush()
        await self.session.refresh(room)
        return room

    async def delete_room(self, room_id: uuid.UUID, clinic_id: uuid.UUID) -> None:
        query = select(BmsRoom).where(
            BmsRoom.id == room_id, BmsRoom.clinic_id == clinic_id, BmsRoom.is_deleted == False
        )
        result = await self.session.execute(query)
        room = result.scalar_one_or_none()
        if not room:
            raise NotFoundError("BmsRoom", str(room_id))
        room.is_deleted = True
        await self.session.flush()

    # ── Sensors ───────────────────────────────────────────────────────

    async def get_floor_sensors(self, floor_id: uuid.UUID, clinic_id: uuid.UUID) -> list[BmsSensor]:
        query = (
            select(BmsSensor)
            .where(
                BmsSensor.floor_id == floor_id,
                BmsSensor.clinic_id == clinic_id,
                BmsSensor.is_deleted == False,
            )
            .order_by(BmsSensor.sensor_type, BmsSensor.name)
        )
        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def get_sensor_readings(
        self, sensor_id: uuid.UUID, from_dt: datetime, to_dt: datetime,
    ) -> list[BmsSensorReading]:
        query = (
            select(BmsSensorReading)
            .where(
                BmsSensorReading.sensor_id == sensor_id,
                BmsSensorReading.recorded_at >= from_dt,
                BmsSensorReading.recorded_at <= to_dt,
            )
            .order_by(BmsSensorReading.recorded_at)
        )
        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def create_sensor(self, clinic_id: uuid.UUID, data: dict) -> BmsSensor:
        sensor = BmsSensor(id=uuid.uuid4(), clinic_id=clinic_id, **data)
        self.session.add(sensor)
        await self.session.flush()
        await self.session.refresh(sensor)
        return sensor

    async def update_sensor(self, sensor_id: uuid.UUID, clinic_id: uuid.UUID, data: dict) -> BmsSensor:
        query = select(BmsSensor).where(
            BmsSensor.id == sensor_id, BmsSensor.clinic_id == clinic_id, BmsSensor.is_deleted == False
        )
        result = await self.session.execute(query)
        sensor = result.scalar_one_or_none()
        if not sensor:
            raise NotFoundError("BmsSensor", str(sensor_id))
        for k, v in data.items():
            if v is not None:
                setattr(sensor, k, v)
        await self.session.flush()
        await self.session.refresh(sensor)
        return sensor

    async def delete_sensor(self, sensor_id: uuid.UUID, clinic_id: uuid.UUID) -> None:
        query = select(BmsSensor).where(
            BmsSensor.id == sensor_id, BmsSensor.clinic_id == clinic_id, BmsSensor.is_deleted == False
        )
        result = await self.session.execute(query)
        sensor = result.scalar_one_or_none()
        if not sensor:
            raise NotFoundError("BmsSensor", str(sensor_id))
        sensor.is_deleted = True
        await self.session.flush()

    # ── Equipment ─────────────────────────────────────────────────────

    async def get_floor_equipment(self, floor_id: uuid.UUID, clinic_id: uuid.UUID) -> list[Equipment]:
        query = (
            select(Equipment)
            .join(BmsRoom, Equipment.bms_room_id == BmsRoom.id)
            .where(
                BmsRoom.floor_id == floor_id,
                Equipment.clinic_id == clinic_id,
                Equipment.is_deleted == False,
            )
            .order_by(Equipment.equipment_type, Equipment.name)
        )
        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def get_room_equipment(self, room_id: uuid.UUID, clinic_id: uuid.UUID) -> list[Equipment]:
        query = (
            select(Equipment)
            .where(
                Equipment.bms_room_id == room_id,
                Equipment.clinic_id == clinic_id,
                Equipment.is_deleted == False,
            )
            .order_by(Equipment.name)
        )
        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def create_equipment(self, clinic_id: uuid.UUID, data: dict) -> Equipment:
        equipment = Equipment(id=uuid.uuid4(), clinic_id=clinic_id, **data)
        self.session.add(equipment)
        await self.session.flush()
        await self.session.refresh(equipment)
        return equipment

    async def update_equipment(self, equipment_id: uuid.UUID, clinic_id: uuid.UUID, data: dict) -> Equipment:
        query = select(Equipment).where(
            Equipment.id == equipment_id, Equipment.clinic_id == clinic_id, Equipment.is_deleted == False
        )
        result = await self.session.execute(query)
        equipment = result.scalar_one_or_none()
        if not equipment:
            raise NotFoundError("Equipment", str(equipment_id))
        for k, v in data.items():
            if v is not None:
                setattr(equipment, k, v)
        await self.session.flush()
        await self.session.refresh(equipment)
        return equipment

    async def send_command(
        self,
        equipment_id: uuid.UUID,
        clinic_id: uuid.UUID,
        user_id: uuid.UUID,
        command: str,
        parameters: dict | None = None,
    ) -> EquipmentCommand:
        # Verify equipment exists
        query = select(Equipment).where(
            Equipment.id == equipment_id, Equipment.clinic_id == clinic_id, Equipment.is_deleted == False
        )
        result = await self.session.execute(query)
        equipment = result.scalar_one_or_none()
        if not equipment:
            raise NotFoundError("Equipment", str(equipment_id))

        now = datetime.now(timezone.utc)

        # Create command record
        cmd = EquipmentCommand(
            id=uuid.uuid4(),
            clinic_id=clinic_id,
            equipment_id=equipment_id,
            command=EquipmentCommandType(command),
            parameters=parameters,
            issued_by_id=user_id,
            issued_at=now,
            status=CommandStatus.EXECUTED,
            executed_at=now,
        )
        self.session.add(cmd)

        # Update equipment status based on command
        if command == "TURN_ON":
            equipment.status = EquipmentStatus.ON
        elif command == "TURN_OFF":
            equipment.status = EquipmentStatus.OFF
        elif command == "SET_PARAMETER" and parameters:
            equipment.parameters = {**(equipment.parameters or {}), **parameters}
        elif command == "RESTART":
            equipment.status = EquipmentStatus.ON

        equipment.last_status_change = now

        await self.session.flush()
        await self.session.refresh(cmd)
        return cmd

    async def get_equipment_commands(
        self, equipment_id: uuid.UUID, limit: int = 20,
    ) -> list[EquipmentCommand]:
        query = (
            select(EquipmentCommand)
            .where(EquipmentCommand.equipment_id == equipment_id)
            .order_by(EquipmentCommand.issued_at.desc())
            .limit(limit)
        )
        result = await self.session.execute(query)
        return list(result.scalars().all())

    # ── Alerts ────────────────────────────────────────────────────────

    async def get_alerts(
        self,
        clinic_id: uuid.UUID,
        status: str | None = None,
        severity: str | None = None,
        floor_id: uuid.UUID | None = None,
        limit: int = 50,
    ) -> list[BmsAlert]:
        clauses = [
            BmsAlert.clinic_id == clinic_id,
            BmsAlert.is_deleted == False,
        ]
        if status:
            clauses.append(BmsAlert.status == BmsAlertStatus(status))
        if severity:
            clauses.append(BmsAlert.severity == BmsAlertSeverity(severity))
        if floor_id:
            clauses.append(BmsAlert.floor_id == floor_id)
        query = (
            select(BmsAlert)
            .where(*clauses)
            .order_by(BmsAlert.created_at.desc())
            .limit(limit)
        )
        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def acknowledge_alert(
        self, alert_id: uuid.UUID, clinic_id: uuid.UUID, user_id: uuid.UUID,
    ) -> BmsAlert:
        query = select(BmsAlert).where(
            BmsAlert.id == alert_id,
            BmsAlert.clinic_id == clinic_id,
            BmsAlert.is_deleted == False,
        )
        result = await self.session.execute(query)
        alert = result.scalar_one_or_none()
        if not alert:
            raise NotFoundError("BmsAlert", str(alert_id))
        alert.status = BmsAlertStatus.ACKNOWLEDGED
        alert.acknowledged_by_id = user_id
        alert.acknowledged_at = datetime.now(timezone.utc)
        await self.session.flush()
        await self.session.refresh(alert)
        return alert

    async def resolve_alert(
        self, alert_id: uuid.UUID, clinic_id: uuid.UUID, user_id: uuid.UUID,
    ) -> BmsAlert:
        query = select(BmsAlert).where(
            BmsAlert.id == alert_id,
            BmsAlert.clinic_id == clinic_id,
            BmsAlert.is_deleted == False,
        )
        result = await self.session.execute(query)
        alert = result.scalar_one_or_none()
        if not alert:
            raise NotFoundError("BmsAlert", str(alert_id))
        alert.status = BmsAlertStatus.RESOLVED
        alert.resolved_by_id = user_id
        alert.resolved_at = datetime.now(timezone.utc)
        await self.session.flush()
        await self.session.refresh(alert)
        return alert

    async def create_alert(
        self,
        clinic_id: uuid.UUID,
        floor_id: uuid.UUID | None,
        bms_room_id: uuid.UUID | None,
        sensor_id: uuid.UUID | None,
        equipment_id: uuid.UUID | None,
        alert_type: BmsAlertType,
        severity: BmsAlertSeverity,
        title: str,
        message: str,
    ) -> BmsAlert:
        alert = BmsAlert(
            id=uuid.uuid4(),
            clinic_id=clinic_id,
            floor_id=floor_id,
            bms_room_id=bms_room_id,
            sensor_id=sensor_id,
            equipment_id=equipment_id,
            alert_type=alert_type,
            severity=severity,
            title=title,
            message=message,
            status=BmsAlertStatus.ACTIVE,
        )
        self.session.add(alert)
        await self.session.flush()
        await self.session.refresh(alert)
        return alert

    # ── Automation Rules ──────────────────────────────────────────────

    async def get_rules(self, clinic_id: uuid.UUID) -> list[AutomationRule]:
        query = (
            select(AutomationRule)
            .where(
                AutomationRule.clinic_id == clinic_id,
                AutomationRule.is_deleted == False,
            )
            .order_by(AutomationRule.name)
        )
        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def create_rule(self, clinic_id: uuid.UUID, data: dict) -> AutomationRule:
        rule = AutomationRule(id=uuid.uuid4(), clinic_id=clinic_id, **data)
        self.session.add(rule)
        await self.session.flush()
        await self.session.refresh(rule)
        return rule

    async def update_rule(self, rule_id: uuid.UUID, clinic_id: uuid.UUID, data: dict) -> AutomationRule:
        query = select(AutomationRule).where(
            AutomationRule.id == rule_id, AutomationRule.clinic_id == clinic_id, AutomationRule.is_deleted == False
        )
        result = await self.session.execute(query)
        rule = result.scalar_one_or_none()
        if not rule:
            raise NotFoundError("AutomationRule", str(rule_id))
        for k, v in data.items():
            if v is not None:
                setattr(rule, k, v)
        await self.session.flush()
        await self.session.refresh(rule)
        return rule

    async def delete_rule(self, rule_id: uuid.UUID, clinic_id: uuid.UUID) -> None:
        query = select(AutomationRule).where(
            AutomationRule.id == rule_id, AutomationRule.clinic_id == clinic_id, AutomationRule.is_deleted == False
        )
        result = await self.session.execute(query)
        rule = result.scalar_one_or_none()
        if not rule:
            raise NotFoundError("AutomationRule", str(rule_id))
        rule.is_deleted = True
        await self.session.flush()

    async def toggle_rule(self, rule_id: uuid.UUID, clinic_id: uuid.UUID) -> AutomationRule:
        query = select(AutomationRule).where(
            AutomationRule.id == rule_id, AutomationRule.clinic_id == clinic_id, AutomationRule.is_deleted == False
        )
        result = await self.session.execute(query)
        rule = result.scalar_one_or_none()
        if not rule:
            raise NotFoundError("AutomationRule", str(rule_id))
        rule.is_active = not rule.is_active
        await self.session.flush()
        await self.session.refresh(rule)
        return rule

    async def get_rule_logs(self, rule_id: uuid.UUID, limit: int = 50) -> list[AutomationLog]:
        query = (
            select(AutomationLog)
            .where(AutomationLog.rule_id == rule_id)
            .order_by(AutomationLog.triggered_at.desc())
            .limit(limit)
        )
        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def evaluate_rules(
        self,
        clinic_id: uuid.UUID,
        sensor_type: str,
        value: float,
        floor_id: uuid.UUID | None = None,
        room_id: uuid.UUID | None = None,
    ) -> list[AutomationLog]:
        """Check all active rules against a sensor reading, execute matching actions, log results."""
        query = (
            select(AutomationRule)
            .where(
                AutomationRule.clinic_id == clinic_id,
                AutomationRule.is_deleted == False,
                AutomationRule.is_active == True,
                AutomationRule.condition_sensor_type == sensor_type,
            )
        )
        result = await self.session.execute(query)
        rules = list(result.scalars().all())

        logs: list[AutomationLog] = []
        now = datetime.now(timezone.utc)

        for rule in rules:
            # Check scope (floor/room)
            if rule.condition_floor_id and rule.condition_floor_id != floor_id:
                continue
            if rule.condition_room_id and rule.condition_room_id != room_id:
                continue

            # Evaluate condition
            if not _evaluate_condition(rule.condition_operator.value, value, rule.condition_value):
                continue

            # Execute action — find target equipment
            success = True
            error_message = None
            action_taken = f"{rule.action_command}"

            try:
                if rule.action_equipment_id:
                    # Target a specific equipment
                    eq_query = select(Equipment).where(
                        Equipment.id == rule.action_equipment_id,
                        Equipment.is_deleted == False,
                    )
                    eq_result = await self.session.execute(eq_query)
                    eq = eq_result.scalar_one_or_none()
                    if eq:
                        if rule.action_command == "TURN_ON":
                            eq.status = EquipmentStatus.ON
                        elif rule.action_command == "TURN_OFF":
                            eq.status = EquipmentStatus.OFF
                        if rule.action_parameters:
                            eq.parameters = {**(eq.parameters or {}), **rule.action_parameters}
                        eq.last_status_change = now
                        action_taken = f"{rule.action_command} {eq.name}"
                    else:
                        success = False
                        error_message = "Target equipment not found"
                elif rule.action_equipment_type:
                    # Target all equipment of type in scope
                    eq_clauses = [
                        Equipment.clinic_id == clinic_id,
                        Equipment.is_deleted == False,
                        Equipment.equipment_type == rule.action_equipment_type,
                    ]
                    if room_id:
                        eq_clauses.append(Equipment.bms_room_id == room_id)
                    elif floor_id:
                        eq_clauses.append(
                            Equipment.bms_room_id.in_(
                                select(BmsRoom.id).where(BmsRoom.floor_id == floor_id)
                            )
                        )
                    eq_query = select(Equipment).where(*eq_clauses)
                    eq_result = await self.session.execute(eq_query)
                    equipments = list(eq_result.scalars().all())
                    for eq in equipments:
                        if rule.action_command == "TURN_ON":
                            eq.status = EquipmentStatus.ON
                        elif rule.action_command == "TURN_OFF":
                            eq.status = EquipmentStatus.OFF
                        if rule.action_parameters:
                            eq.parameters = {**(eq.parameters or {}), **rule.action_parameters}
                        eq.last_status_change = now
                    action_taken = f"{rule.action_command} {len(equipments)} {rule.action_equipment_type}"
            except Exception as e:
                success = False
                error_message = str(e)

            # Update rule stats
            rule.last_triggered_at = now
            rule.trigger_count = (rule.trigger_count or 0) + 1

            # Create log entry
            log = AutomationLog(
                id=uuid.uuid4(),
                rule_id=rule.id,
                triggered_at=now,
                sensor_value=value,
                action_taken=action_taken,
                success=success,
                error_message=error_message,
            )
            self.session.add(log)
            logs.append(log)

        if logs:
            await self.session.flush()

        return logs

    # ── Dashboard ─────────────────────────────────────────────────────

    async def get_dashboard(self, clinic_id: uuid.UUID) -> dict:
        # Total sensors / active sensors
        sensor_total_q = select(func.count(BmsSensor.id)).where(
            BmsSensor.clinic_id == clinic_id, BmsSensor.is_deleted == False,
        )
        sensor_active_q = select(func.count(BmsSensor.id)).where(
            BmsSensor.clinic_id == clinic_id, BmsSensor.is_deleted == False, BmsSensor.is_active == True,
        )

        # Active alerts by severity
        alert_q = (
            select(BmsAlert.severity, func.count(BmsAlert.id))
            .where(
                BmsAlert.clinic_id == clinic_id,
                BmsAlert.is_deleted == False,
                BmsAlert.status == BmsAlertStatus.ACTIVE,
            )
            .group_by(BmsAlert.severity)
        )

        # Average temperature
        avg_temp_q = select(func.avg(BmsSensor.last_value)).where(
            BmsSensor.clinic_id == clinic_id,
            BmsSensor.is_deleted == False,
            BmsSensor.is_active == True,
            BmsSensor.sensor_type == BmsSensorType.TEMPERATURE,
            BmsSensor.last_value.isnot(None),
        )

        # Energy consumption — sum of POWER_METER latest values
        energy_q = select(func.sum(BmsSensor.last_value)).where(
            BmsSensor.clinic_id == clinic_id,
            BmsSensor.is_deleted == False,
            BmsSensor.is_active == True,
            BmsSensor.sensor_type == BmsSensorType.POWER_METER,
            BmsSensor.last_value.isnot(None),
        )

        # Execute all queries
        total_res = await self.session.execute(sensor_total_q)
        active_res = await self.session.execute(sensor_active_q)
        alert_res = await self.session.execute(alert_q)
        avg_temp_res = await self.session.execute(avg_temp_q)
        energy_res = await self.session.execute(energy_q)

        sensor_total = total_res.scalar() or 0
        sensor_active = active_res.scalar() or 0
        avg_temp = avg_temp_res.scalar()
        energy = energy_res.scalar() or 0.0

        alerts_by_severity: dict[str, int] = {}
        total_active_alerts = 0
        for row in alert_res:
            sev, cnt = row
            sev_val = sev.value if hasattr(sev, "value") else str(sev)
            alerts_by_severity[sev_val] = cnt
            total_active_alerts += cnt

        # Floor statuses
        floors_q = (
            select(Floor)
            .where(Floor.clinic_id == clinic_id, Floor.is_deleted == False)
            .order_by(Floor.sort_order, Floor.floor_number)
        )
        floors_res = await self.session.execute(floors_q)
        floors = list(floors_res.scalars().all())

        floor_statuses = []
        for floor in floors:
            # Get worst alert severity for floor
            worst_q = (
                select(BmsAlert.severity)
                .where(
                    BmsAlert.clinic_id == clinic_id,
                    BmsAlert.floor_id == floor.id,
                    BmsAlert.is_deleted == False,
                    BmsAlert.status == BmsAlertStatus.ACTIVE,
                )
                .order_by(BmsAlert.severity.desc())
                .limit(1)
            )
            worst_res = await self.session.execute(worst_q)
            worst_sev = worst_res.scalar_one_or_none()

            # Floor alert count
            floor_alert_q = select(func.count(BmsAlert.id)).where(
                BmsAlert.clinic_id == clinic_id,
                BmsAlert.floor_id == floor.id,
                BmsAlert.is_deleted == False,
                BmsAlert.status == BmsAlertStatus.ACTIVE,
            )
            floor_alert_res = await self.session.execute(floor_alert_q)
            floor_alert_count = floor_alert_res.scalar() or 0

            # Floor avg temp
            floor_temp_q = select(func.avg(BmsSensor.last_value)).where(
                BmsSensor.clinic_id == clinic_id,
                BmsSensor.floor_id == floor.id,
                BmsSensor.is_deleted == False,
                BmsSensor.is_active == True,
                BmsSensor.sensor_type == BmsSensorType.TEMPERATURE,
                BmsSensor.last_value.isnot(None),
            )
            floor_temp_res = await self.session.execute(floor_temp_q)
            floor_avg_temp = floor_temp_res.scalar()

            floor_statuses.append({
                "floor_id": str(floor.id),
                "floor_number": floor.floor_number,
                "name": floor.name,
                "alert_count": floor_alert_count,
                "worst_severity": worst_sev.value if worst_sev and hasattr(worst_sev, "value") else (str(worst_sev) if worst_sev else "NORMAL"),
                "avg_temperature": round(floor_avg_temp, 1) if floor_avg_temp else None,
            })

        return {
            "sensor_total": sensor_total,
            "sensor_active": sensor_active,
            "active_alerts": total_active_alerts,
            "alerts_by_severity": alerts_by_severity,
            "avg_temperature": round(avg_temp, 1) if avg_temp else None,
            "energy_consumption": round(energy, 2),
            "floor_statuses": floor_statuses,
        }
