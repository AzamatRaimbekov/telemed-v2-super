# Patient Portal Module — Design Spec

> Full ТЗ provided by user. See original for complete details.

## Scope
8 sub-modules, 38 API endpoints, MediaPipe exercise tracking, telemedicine, messaging.

## Phases
- **Phase A**: Backend (DB models, migrations, all 38 endpoints, portal auth, exercise seed)
- **Phase B**: Frontend core (portal layout, dashboard, medical card, lab results, billing, appointments)  
- **Phase C**: Advanced (MediaPipe sessions, telemedicine, WebSocket chat, notifications)

## Key Decisions
- Separate JWT for portal (2h TTL)
- Portal auth via phone + password
- Lab results require doctor approval before patient visibility
- MediaPipe Pose WASM for exercise tracking
- Daily.co for telemedicine video
