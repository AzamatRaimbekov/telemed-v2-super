import asyncio
import uuid
from app.core.database import async_session_factory
from app.models.exercise import Exercise, ExerciseCategory, ExerciseDifficulty
from sqlalchemy import select

EXERCISES = [
    # Upper limb (5)
    {
        "name": "Сгибание плеча",
        "description": "Поднимите руку вперёд до уровня плеча (90°). Медленно опустите. Повторите.",
        "category": ExerciseCategory.UPPER_LIMB,
        "difficulty": ExerciseDifficulty.EASY,
        "target_joints": ["left_shoulder", "right_shoulder"],
        "angle_thresholds": {"start": 10, "end": 90, "joint": "shoulder_flexion"},
        "instructions": "Встаньте прямо. Медленно поднимите руку вперёд до уровня плеча. Задержитесь на 1 секунду. Медленно опустите.",
        "default_sets": 3,
        "default_reps": 10,
    },
    {
        "name": "Отведение плеча",
        "description": "Поднимите руку в сторону до уровня плеча. Медленно опустите.",
        "category": ExerciseCategory.UPPER_LIMB,
        "difficulty": ExerciseDifficulty.EASY,
        "target_joints": ["left_shoulder", "right_shoulder"],
        "angle_thresholds": {"start": 10, "end": 90, "joint": "shoulder_abduction"},
        "instructions": "Встаньте прямо. Поднимите руку в сторону до уровня плеча. Задержитесь. Опустите.",
        "default_sets": 3,
        "default_reps": 10,
    },
    {
        "name": "Разгибание локтя",
        "description": "Из согнутого положения выпрямите руку полностью. Медленно согните обратно.",
        "category": ExerciseCategory.UPPER_LIMB,
        "difficulty": ExerciseDifficulty.EASY,
        "target_joints": ["left_elbow", "right_elbow"],
        "angle_thresholds": {"start": 60, "end": 160, "joint": "elbow_extension"},
        "instructions": "Согните руку в локте. Медленно разогните до полного выпрямления. Задержите. Согните обратно.",
        "default_sets": 3,
        "default_reps": 12,
    },
    {
        "name": "Вращение запястья",
        "description": "Вращайте кисть по часовой стрелке и против.",
        "category": ExerciseCategory.UPPER_LIMB,
        "difficulty": ExerciseDifficulty.EASY,
        "target_joints": ["left_wrist", "right_wrist"],
        "angle_thresholds": {"start": 0, "end": 360, "joint": "wrist_rotation"},
        "instructions": "Вытяните руку вперёд. Вращайте кисть по часовой стрелке 10 раз, затем против часовой 10 раз.",
        "default_sets": 2,
        "default_reps": 10,
    },
    {
        "name": "Разжатие кулака",
        "description": "Сожмите руку в кулак, затем полностью раскройте пальцы.",
        "category": ExerciseCategory.UPPER_LIMB,
        "difficulty": ExerciseDifficulty.EASY,
        "target_joints": ["left_hand", "right_hand"],
        "angle_thresholds": {"start": 0, "end": 180, "joint": "finger_extension"},
        "instructions": "Крепко сожмите кулак на 2 секунды. Полностью раскройте пальцы. Задержите на 2 секунды. Повторите.",
        "default_sets": 3,
        "default_reps": 15,
    },
    # Lower limb (5)
    {
        "name": "Накачка голеностопа",
        "description": "Поднимите носок стопы вверх, затем опустите вниз.",
        "category": ExerciseCategory.LOWER_LIMB,
        "difficulty": ExerciseDifficulty.EASY,
        "target_joints": ["left_ankle", "right_ankle"],
        "angle_thresholds": {"start": 70, "end": 120, "joint": "ankle_dorsiflexion"},
        "instructions": "Сидя, поднимите носок вверх (к себе). Задержите. Опустите носок вниз (от себя). Повторите.",
        "default_sets": 3,
        "default_reps": 15,
    },
    {
        "name": "Разгибание колена (сидя)",
        "description": "Сидя на стуле, выпрямите ногу вперёд. Медленно опустите.",
        "category": ExerciseCategory.LOWER_LIMB,
        "difficulty": ExerciseDifficulty.MEDIUM,
        "target_joints": ["left_knee", "right_knee"],
        "angle_thresholds": {"start": 80, "end": 170, "joint": "knee_extension"},
        "instructions": "Сядьте на стул, стопы на полу. Медленно выпрямите одну ногу. Задержите на 3 секунды. Опустите. Повторите.",
        "default_sets": 3,
        "default_reps": 10,
    },
    {
        "name": "Отведение бедра (лёжа)",
        "description": "Лёжа на спине, отведите ногу в сторону. Вернитесь.",
        "category": ExerciseCategory.LOWER_LIMB,
        "difficulty": ExerciseDifficulty.MEDIUM,
        "target_joints": ["left_hip", "right_hip"],
        "angle_thresholds": {"start": 0, "end": 40, "joint": "hip_abduction"},
        "instructions": "Лягте на спину. Медленно отведите прямую ногу в сторону. Задержите. Верните в исходное положение.",
        "default_sets": 3,
        "default_reps": 10,
    },
    {
        "name": "Переход сидя → стоя",
        "description": "Встаньте со стула без помощи рук. Сядьте обратно контролируемо.",
        "category": ExerciseCategory.LOWER_LIMB,
        "difficulty": ExerciseDifficulty.HARD,
        "target_joints": ["left_knee", "right_knee", "left_hip", "right_hip"],
        "angle_thresholds": {"start": 80, "end": 170, "joint": "sit_to_stand"},
        "instructions": "Сядьте на край стула. Наклонитесь вперёд. Встаньте, выпрямляя ноги. Медленно сядьте обратно.",
        "default_sets": 3,
        "default_reps": 8,
    },
    {
        "name": "Перенос веса",
        "description": "Стоя, покачивайтесь с одной ноги на другую.",
        "category": ExerciseCategory.LOWER_LIMB,
        "difficulty": ExerciseDifficulty.MEDIUM,
        "target_joints": ["left_hip", "right_hip"],
        "angle_thresholds": {"start": -15, "end": 15, "joint": "weight_shift"},
        "instructions": "Встаньте, ноги на ширине плеч. Перенесите вес на правую ногу. Задержите 3 сек. Перенесите на левую. Повторите.",
        "default_sets": 3,
        "default_reps": 10,
    },
    # Balance (3)
    {
        "name": "Стойка на одной ноге",
        "description": "Удерживайте равновесие на одной ноге 10 секунд.",
        "category": ExerciseCategory.BALANCE,
        "difficulty": ExerciseDifficulty.HARD,
        "target_joints": ["left_knee", "right_knee", "left_hip", "right_hip"],
        "angle_thresholds": {"start": 0, "end": 10, "joint": "single_leg_balance"},
        "instructions": "Встаньте у опоры. Поднимите одну ногу. Удерживайте баланс 10 секунд. Смените ногу.",
        "default_sets": 3,
        "default_reps": 5,
    },
    {
        "name": "Тандемная стойка",
        "description": "Поставьте стопы в линию (пятка к носку) и удерживайте баланс.",
        "category": ExerciseCategory.BALANCE,
        "difficulty": ExerciseDifficulty.MEDIUM,
        "target_joints": ["left_ankle", "right_ankle"],
        "angle_thresholds": {"start": 0, "end": 5, "joint": "tandem_stance"},
        "instructions": "Поставьте одну стопу прямо перед другой, пятка к носку. Удерживайте позу 15 секунд. Смените порядок ног.",
        "default_sets": 3,
        "default_reps": 5,
    },
    {
        "name": "Марш на месте",
        "description": "Поочерёдно поднимайте колени, маршируя на месте.",
        "category": ExerciseCategory.GAIT,
        "difficulty": ExerciseDifficulty.MEDIUM,
        "target_joints": ["left_knee", "right_knee", "left_hip", "right_hip"],
        "angle_thresholds": {"start": 160, "end": 90, "joint": "knee_lift"},
        "instructions": "Встаньте прямо. Поочерёдно поднимайте колени как при ходьбе. Поддерживайте ритм.",
        "default_sets": 3,
        "default_reps": 20,
    },
    # General (2)
    {
        "name": "Наклоны шеи",
        "description": "Медленно наклоняйте голову влево, вправо, вперёд и назад.",
        "category": ExerciseCategory.BALANCE,
        "difficulty": ExerciseDifficulty.EASY,
        "target_joints": ["neck"],
        "angle_thresholds": {"start": 0, "end": 30, "joint": "neck_lateral_flexion"},
        "instructions": "Сидя прямо, медленно наклоните голову к правому плечу. Задержите 5 сек. Вернитесь. Повторите влево.",
        "default_sets": 2,
        "default_reps": 8,
    },
    {
        "name": "Глубокое дыхание с подъёмом рук",
        "description": "Вдох — руки вверх, выдох — руки вниз. Координация дыхания и движения.",
        "category": ExerciseCategory.BALANCE,
        "difficulty": ExerciseDifficulty.EASY,
        "target_joints": ["left_shoulder", "right_shoulder"],
        "angle_thresholds": {"start": 0, "end": 170, "joint": "shoulder_flexion_breathing"},
        "instructions": "Встаньте или сядьте прямо. На вдохе медленно поднимите руки через стороны вверх. На выдохе опустите. Дышите глубоко.",
        "default_sets": 3,
        "default_reps": 8,
    },
]


async def seed_exercises():
    async with async_session_factory() as session:
        # Get clinic_id from existing clinic
        from app.models.clinic import Clinic
        result = await session.execute(select(Clinic).limit(1))
        clinic = result.scalar_one_or_none()
        if not clinic:
            print("No clinic found. Run seed.py first.")
            return

        # Check if exercises already seeded
        existing = await session.execute(select(Exercise).limit(1))
        if existing.scalar_one_or_none():
            print("Exercises already seeded.")
            return

        for ex_data in EXERCISES:
            exercise = Exercise(
                id=uuid.uuid4(),
                name=ex_data["name"],
                description=ex_data["description"],
                category=ex_data["category"],
                difficulty=ex_data["difficulty"],
                target_joints=ex_data["target_joints"],
                angle_thresholds=ex_data["angle_thresholds"],
                instructions=ex_data["instructions"],
                default_sets=ex_data["default_sets"],
                default_reps=ex_data["default_reps"],
                is_active=True,
                clinic_id=clinic.id,
            )
            session.add(exercise)

        await session.commit()
        print(f"Seeded {len(EXERCISES)} exercises successfully!")


if __name__ == "__main__":
    asyncio.run(seed_exercises())
