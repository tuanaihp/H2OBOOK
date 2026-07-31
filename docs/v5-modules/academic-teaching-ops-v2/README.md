# H2OBOOK Academic & Teaching Operations V2 Unified

Module V2 hợp nhất toàn bộ Academic Operations V1 và bổ sung sáu surface vận hành giảng dạy:

- `/automations`
- `/class-view`
- `/collaboration`
- `/processing`
- `/reviews`
- `/students`

V2 thay thế V1 khi bắt đầu tích hợp. Không đưa đồng thời V1 và V2 cho Claude Code.

## Preview routes

- `/academic-ops-v2-preview/dashboard`
- `/academic-ops-v2-preview/learn`
- `/academic-ops-v2-preview/knowledge`
- `/academic-ops-v2-preview/library`
- `/academic-ops-v2-preview/assignments`
- `/academic-ops-v2-preview/classes`
- `/academic-ops-v2-preview/quizzes`
- `/academic-ops-v2-preview/study`
- `/academic-ops-v2-preview/class-view`
- `/academic-ops-v2-preview/students`
- `/academic-ops-v2-preview/reviews`
- `/academic-ops-v2-preview/collaboration`
- `/academic-ops-v2-preview/automations`
- `/academic-ops-v2-preview/processing`

## Feature flags

```env
NEXT_PUBLIC_ACADEMIC_OPERATIONS_V2=false
NEXT_PUBLIC_ACADEMIC_OPERATIONS_PREVIEW=true
```

Module không thêm dependency npm và không chạy migration database.
