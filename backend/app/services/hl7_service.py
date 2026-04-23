"""HL7/FHIR integration service for lab analyzer connectivity."""
import json
from datetime import datetime, timezone


class HL7Message:
    """Parse and create HL7 v2.x messages."""

    @staticmethod
    def parse_oru(raw_message: str) -> dict:
        """Parse HL7 ORU (Observation Result) message from lab analyzer."""
        segments = raw_message.strip().split("\r")
        result = {"type": "ORU", "patient": {}, "results": [], "raw": raw_message}

        for seg in segments:
            fields = seg.split("|")
            seg_type = fields[0] if fields else ""

            if seg_type == "PID" and len(fields) > 5:
                name_parts = fields[5].split("^") if len(fields) > 5 else []
                result["patient"] = {
                    "id": fields[3] if len(fields) > 3 else "",
                    "last_name": name_parts[0] if name_parts else "",
                    "first_name": name_parts[1] if len(name_parts) > 1 else "",
                }
            elif seg_type == "OBX" and len(fields) > 5:
                result["results"].append({
                    "test_code": fields[3] if len(fields) > 3 else "",
                    "value": fields[5] if len(fields) > 5 else "",
                    "unit": fields[6] if len(fields) > 6 else "",
                    "reference_range": fields[7] if len(fields) > 7 else "",
                    "flag": fields[8] if len(fields) > 8 else "",  # H=high, L=low, N=normal
                })
        return result

    @staticmethod
    def create_ack(message_id: str) -> str:
        """Create HL7 ACK response."""
        now = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
        return f"MSH|^~\\&|MEDCORE|CLINIC|LAB|ANALYZER|{now}||ACK|{message_id}|P|2.5\rMSA|AA|{message_id}"


class FHIRConverter:
    """Convert between FHIR resources and internal models."""

    @staticmethod
    def observation_to_lab_result(fhir_obs: dict) -> dict:
        """Convert FHIR Observation to internal lab result format."""
        return {
            "test_code": fhir_obs.get("code", {}).get("coding", [{}])[0].get("code", ""),
            "test_name": fhir_obs.get("code", {}).get("text", ""),
            "value": fhir_obs.get("valueQuantity", {}).get("value"),
            "unit": fhir_obs.get("valueQuantity", {}).get("unit", ""),
            "reference_range": fhir_obs.get("referenceRange", [{}])[0].get("text", ""),
            "status": fhir_obs.get("status", ""),
            "issued": fhir_obs.get("issued", ""),
        }

    @staticmethod
    def patient_to_fhir(patient_data: dict) -> dict:
        """Convert internal patient to FHIR Patient resource."""
        return {
            "resourceType": "Patient",
            "id": patient_data.get("id"),
            "name": [{"family": patient_data.get("last_name"), "given": [patient_data.get("first_name")]}],
            "birthDate": patient_data.get("date_of_birth"),
            "gender": patient_data.get("gender", "unknown"),
            "telecom": [{"system": "phone", "value": patient_data.get("phone")}] if patient_data.get("phone") else [],
        }
