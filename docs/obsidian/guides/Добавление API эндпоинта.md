---
aliases: [New Endpoint, API Guide]
tags: [guide, api, backend]
created: 2026-04-20
---

# Добавление API эндпоинта

## Быстрый гайд

### 1. Схема запроса/ответа

`backend/app/schemas/`:
```python
class ItemCreate(BaseModel):
    name: str
    value: float

class ItemResponse(BaseModel):
    id: int
    name: str
    value: float
    created_at: datetime

    class Config:
        from_attributes = True
```

### 2. Сервис (бизнес-логика)

`backend/app/services/`:
```python
async def create_item(db: AsyncSession, data: ItemCreate, clinic_id: int):
    item = Item(**data.model_dump(), clinic_id=clinic_id)
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item
```

### 3. Маршрут

`backend/app/api/v1/routes/`:
```python
@router.post("/", response_model=ItemResponse)
async def create(
    data: ItemCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await create_item(db, data, current_user.clinic_id)
```

### 4. Frontend хук

`frontend/src/features/`:
```typescript
export const useCreateItem = () =>
  useMutation({
    mutationFn: (data: ItemCreate) =>
      apiClient.post('/items/', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] })
    },
  })
```

## Связанные документы

- [[API Endpoints]]
- [[Добавление нового модуля]]
- [[Backend Overview]]
