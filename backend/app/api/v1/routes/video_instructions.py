from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/video-instructions", tags=["Video Instructions"])

DENTAL_VIDEOS = [
    {"id": "care-after-filling", "title": "Уход после пломбирования", "category": "aftercare",
     "description": "Что можно и нельзя делать после установки пломбы", "duration": "3:45",
     "thumbnail": "/api/v1/static/thumbnails/filling.jpg", "video_url": ""},
    {"id": "care-after-extraction", "title": "Уход после удаления зуба", "category": "aftercare",
     "description": "Рекомендации на первые 24 часа после удаления", "duration": "4:20",
     "thumbnail": "/api/v1/static/thumbnails/extraction.jpg", "video_url": ""},
    {"id": "braces-care", "title": "Уход за брекетами", "category": "orthodontics",
     "description": "Как правильно чистить зубы с брекетами", "duration": "5:10",
     "thumbnail": "/api/v1/static/thumbnails/braces.jpg", "video_url": ""},
    {"id": "aligners-care", "title": "Правила ношения элайнеров", "category": "orthodontics",
     "description": "Как носить и ухаживать за элайнерами", "duration": "3:30",
     "thumbnail": "/api/v1/static/thumbnails/aligners.jpg", "video_url": ""},
    {"id": "brushing-technique", "title": "Правильная техника чистки зубов", "category": "hygiene",
     "description": "Метод Басса — рекомендация стоматологов", "duration": "4:00",
     "thumbnail": "/api/v1/static/thumbnails/brushing.jpg", "video_url": ""},
    {"id": "flossing", "title": "Как пользоваться зубной нитью", "category": "hygiene",
     "description": "Ежедневная чистка межзубных промежутков", "duration": "2:50",
     "thumbnail": "/api/v1/static/thumbnails/flossing.jpg", "video_url": ""},
    {"id": "implant-care", "title": "Уход за имплантами", "category": "aftercare",
     "description": "Как ухаживать за зубными имплантами", "duration": "4:15",
     "thumbnail": "/api/v1/static/thumbnails/implant.jpg", "video_url": ""},
    {"id": "whitening-aftercare", "title": "После отбеливания", "category": "aftercare",
     "description": "Белая диета и рекомендации после отбеливания", "duration": "3:00",
     "thumbnail": "/api/v1/static/thumbnails/whitening.jpg", "video_url": ""},
]


@router.get("/")
async def list_videos(category: str | None = None):
    if category:
        return [v for v in DENTAL_VIDEOS if v["category"] == category]
    return DENTAL_VIDEOS


@router.get("/categories")
async def video_categories():
    return [
        {"id": "aftercare", "name": "После лечения", "count": 4},
        {"id": "orthodontics", "name": "Ортодонтия", "count": 2},
        {"id": "hygiene", "name": "Гигиена", "count": 2},
    ]


@router.get("/{video_id}")
async def get_video(video_id: str):
    for v in DENTAL_VIDEOS:
        if v["id"] == video_id:
            return v
    raise HTTPException(404, "Video not found")
