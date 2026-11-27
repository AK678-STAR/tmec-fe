# TÀI LIỆU ĐẶC TẢ NGHIỆP VỤ & RÀNG BUỘC KỸ THUẬT PHÂN HỆ HUẤN LUYỆN VIÊN (HEAD TRAINER WORKSPACE)
**Hệ thống:** EquiFlow – Nền tảng Quản lý Chuồng trại & Huấn luyện Ngựa đua  
**Chuyên đề phân hệ:** Phân hệ Huấn luyện viên Trưởng (Head Trainer)  
**Phiên bản:** v2.0.0 (Code-Driven 100% – Trích xuất trực tiếp từ mã nguồn thực tế)  
**Ngày cập nhật:** 27/11/2026  

---

## 1. TỔNG QUAN PHÂN HỆ & MA TRẬN PHÂN QUYỀN CỐ ĐỊNH

### 1.1. Phạm vi & Vai trò Huấn luyện viên Trưởng
Trong hệ thống EquiFlow, Huấn luyện viên Trưởng (`Role.HEAD_TRAINER`) là nhân sự chuyên môn phụ trách trực tiếp quá trình chuẩn bị thể lực, nâng cao phong độ và sát hạch tốc độ của các chiến mã đua.
- **Phạm vi quản lý chuyên môn**:
  - Tiếp nhận chiến mã được Quản lý CLB (`Role.CLUB_MANAGER`) phân công theo đúng Khu chuồng (`Barn`) phụ trách.
  - Soạn thảo và điều hành vòng đời giáo án huấn luyện (từ 1 đến 12 giai đoạn sinh lý).
  - Lên lịch tập tuần, điều phối khung giờ tập luyện, kiểm soát sức chứa đường chạy và phòng chống va chạm tốc độ cao.
  - **Tự điều hành buổi tập & kiêm nài ngựa (Quy tắc #4, #7)**: HLV trực tiếp dẫn dắt ca tập và cưỡi ngựa trên đường chạy, không giao ca tập cho Groom.
  - Ghi nhận chỉ số viễn trắc sinh học (cự ly, thời gian, tốc độ trung bình, nhịp tim nghỉ / đỉnh / hồi phục) và giám sát nguy cơ chấn thương sau buổi tập.
  - Thẩm định 4 tiêu chí sẵn sàng thi đấu trước khi gửi danh sách đăng ký giải đua.

### 1.2. Ma trận Phân quyền Cố định (Permission Matrix)
Theo định nghĩa tại `FE/src/shared/lib/permissions.ts#L215-L221`, tài khoản HLV Trưởng sở hữu mặc định 5 quyền cốt lõi:
1. `viewHorses`: Xem danh bạ và hồ sơ chi tiết các chiến mã trong CLB.
2. `createPlan`: Soạn thảo, chỉnh sửa, kích hoạt, hoàn thành và lưu trữ giáo án huấn luyện.
3. `assignSchedule`: Xếp lịch tập tuần, bố trí bài tập, chọn mặt sân và chỉ định đường chạy huấn luyện.
4. `recordMetrics`: Ghi nhận dữ liệu sinh trắc học và đánh giá phong độ sau buổi tập.
5. `viewMedical`: Xem lịch sử bệnh án và tình trạng khóa huấn luyện y tế của ngựa để đảm bảo an toàn tập luyện (không có quyền tự ý đặt hoặc gỡ khóa y tế – quyền này thuộc độc quyền của Bác sĩ thú y `Role.VETERINARIAN`).

---

## 2. QUY TRÌNH 1: TIẾP NHẬN & PHÂN CÔNG CHIẾN MÃ (HANDOVER & ACCEPTANCE)
*Tệp nguồn: `BE/src/horses/horses.service.ts` (`assignTrainer`, `respondHandover`), `BE/src/horses/horses-handover-qa.spec.ts`*

```
[Quản lý CLB]
     │
     ▼ (assignTrainer: Kiểm tra 4 điều kiện chốt chặn)
     ├── 1. Ô chuồng đang hoạt động (stallAllocations.isActive === true)
     ├── 2. Cùng Khu chuồng (stall.zoneId === trainer.assignedBarnId)
     ├── 3. Định mức tối đa 8 ngựa (MAX_HORSES_PER_TRAINER = 8)
     └── 4. WIP Limit tồn đọng (pendingPlanCount < 2)
     │
     ▼ (Sinh Token 24 bytes Hex, hạn hiệu lực 48 giờ)
[Huấn luyện viên Trưởng]
     │
     ├── Từ chối (REJECT) ──> Thu hồi phân công, ngựa về trạng thái UNASSIGNED
     └── Tiếp nhận (ACCEPT)
                  │
                  └── Cố định SLA 3 ngày lập giáo án (planDeadlineAt = Date.now() + 72h)
```

### 2.1. 4 Ràng buộc Chốt chặn khi Quản lý phân công ngựa cho HLV (`assignTrainer`):
1. **Ràng buộc ô chuồng**: Chiến mã phải được xếp ô chuồng hoạt động (`stallAllocations.isActive === true`). Nếu chưa có ô chuồng → Chặn ném lỗi: *"Chiến mã chưa được xếp ô chuồng đang hoạt động"*.
2. **Ràng buộc cùng Khu chuồng (`BARN_MISMATCH`)**: Khu chuồng của ô chuồng (`stall.zoneId`) phải trùng khớp với Khu chuồng mà HLV đang phụ trách (`trainer.assignedBarnId`). Khác Barn → Chặn ném lỗi: *"HLV [Tên] phụ trách [Barn HLV], không thể nhận ngựa ở [Barn Ngựa]"*.
3. **Ràng buộc Định mức trần 8 chiến mã (`TRAINER_CAPACITY_EXCEEDED`)**: Mỗi HLV chỉ được phụ trách tối đa 8 chiến mã đồng thời (`MAX_HORSES_PER_TRAINER = 8` tại `BE/src/training/training-rules.ts#L69`). Nếu số ngựa hiện tại ≥ 8 → Chặn ném lỗi: *"HLV [Tên] đã đạt định mức tối đa 8 chiến mã đồng thời"*.
4. **Ràng buộc Chốt chặn Tồn đọng WIP Limit (`TRAINER_WIP_LIMIT_EXCEEDED`)**: Đếm số ngựa đã tiếp nhận của HLV nhưng chưa có giáo án `ACTIVE`. Nếu `pendingPlanCount >= 2` → Chặn ném lỗi: *"Huấn luyện viên [Tên] đang tồn [X] chiến mã chưa kích hoạt giáo án. Vui lòng hoàn tất giáo án hiện có trước khi phân công thêm."*

### 2.2. Cơ chế Hạn phản hồi SLA Bàn giao (48 Giờ):
- Hệ thống sinh một chuỗi ngẫu nhiên 24 bytes Hex (`crypto.randomBytes(24).toString('hex')`) làm `token`.
- Thời hạn hiệu lực: `expiresAt = new Date(Date.now() + 48 * 3600 * 1000)` (đúng 48 giờ).
- Nếu HLV phản hồi sau 48 giờ → Ném lỗi `400 BAD_REQUEST`: *"Yêu cầu phân công đã hết hạn phản hồi (48 giờ)."*

### 2.3. Xử lý Tiếp nhận (`ACCEPT`) & Cố định SLA 3 ngày Lập giáo án:
- Cập nhật bản ghi `HorseHandoverRequest`: `status = ACCEPTED`, `acceptedAt = new Date()`.
- Cập nhật bản ghi `Horse`: `assignedTrainerId = req.toTrainerId`, `trainerAssignmentStatus = ASSIGNED`, `trainerRespondedAt = new Date()`.
- **Hạn lập giáo án chuẩn**: Cố định đúng 3 ngày (72 giờ) độc lập cho từng chiến mã:
  > **Công thức tính hạn chót:** `planDeadlineAt = Date.now() + 3 × 24 × 3600 × 1000` (đúng 72 giờ cố định)  
  *(Hệ thống đã loại bỏ hoàn toàn công thức lũy tiến cũ 3 + 2N để chống trôi dạt SLA).*

### 2.4. Cơ chế Đếm ngầm SLA & Cảnh báo Vi phạm KPI (`business-mail.scheduler.ts#L346`):
- Chừng nào giáo án chưa được chuyển sang trạng thái `ACTIVE` (kể cả khi đã có bản nháp `DRAFT`), hệ thống vẫn tính là chưa hoàn thành nghĩa vụ SLA.
- Khi thời gian thực vượt quá `planDeadlineAt`:
  - **Phát sự kiện cảnh báo qua hệ thống thư (`PLAN_SLA_OVERDUE`)**: Gửi thông báo đến cả HLV phụ trách và Quản lý CLB với tiêu đề: `[TMEC Cảnh báo KPI] Quá hạn lập giáo án cho chiến mã [Tên ngựa]`.
  - **Cảnh báo đỏ trên Dashboard HLV**: Hiển thị Badge đỏ *"Quá hạn SLA lập giáo án"*, trừ điểm KPI hoàn thành đúng hạn của HLV.
  - **Khóa nhận thêm việc**: Chiến mã này tiếp tục được tính vào `pendingPlanCount`, kích hoạt chốt chặn WIP Limit khiến HLV không thể nhận thêm ngựa mới.

### 2.5. Cơ chế Cooldown 48 giờ của HLV (`TRAINER_IN_COOLDOWN`):
- *Tệp nguồn:* `BE/src/training/training-plans.service.ts#L978-L986`
- Nếu HLV vừa hủy bản nháp giáo án hoặc để hết hạn bản nháp đối với một chiến mã, HLV sẽ bị đưa vào thời gian chờ **48 giờ (Cooldown)** đối với riêng chiến mã đó:
  > *"Bạn đang trong thời gian chờ ([X] giờ còn lại) đối với chiến mã [Tên] do vừa hủy hoặc để hết hạn bản nháp. Vui lòng liên hệ Quản lý CLB nếu cần mở khóa sớm."*

---

## 3. QUY TRÌNH 2: LẬP & QUẢN LÝ VÒNG ĐỜI GIÁO ÁN HUẤN LUYỆN (TRAINING PLAN LIFECYCLE)
*Tệp nguồn: `BE/src/training/training-plans.service.ts`, `BE/src/training/training-rules.ts`*

```
[Khởi tạo DRAFT] ───> [Kích hoạt ACTIVE] ───> [Hoàn thành COMPLETED] (Miễn trừ SLA)
        │                      │
        ▼                      ▼
  [Hủy CANCELLED]        [Hủy CANCELLED]
        │                      │
        └──────────> [Lưu trữ ARCHIVED]
```

### 3.1. Các trạng thái Giáo án (`PlanStatus`):
- `DRAFT`: Bản nháp, HLV đang xây dựng các giai đoạn và buổi tập.
- `ACTIVE`: Giáo án đang kích hoạt áp dụng thực tế trên chiến mã (mỗi ngựa chỉ có DUY NHẤT 1 giáo án ACTIVE).
- `COMPLETED`: Giáo án đã hoàn thành toàn bộ chu kỳ huấn luyện.
- `CANCELLED`: Giáo án bị hủy bỏ giữa chừng (bắt buộc nhập lý do hủy từ 10 đến 500 ký tự).
- `ARCHIVED`: Giáo án được đưa vào kho lưu trữ hồ sơ lịch sử.

### 3.2. Điều kiện Tạo Giáo án mới (`createPlan`):
- **Trạng thái ngựa hợp lệ**: Chiến mã không bị ngừng quản lý (`HORSE_RETIRED`), không bị Bác sĩ thú y khóa huấn luyện y tế (`HORSE_MEDICAL_LOCKED`), không bị tạm giữ do nợ tiền chuồng (`HORSE_DEBT_IMPOUNDED`).
- **Không thuộc HLV khác (`HORSE_HAS_OTHER_TRAINER`)**: Chiến mã không có giáo án `DRAFT` hoặc `ACTIVE` của HLV khác.
- **Định mức trần HLV (`TRAINER_CAPACITY_EXCEEDED`)**: Tổng số giáo án `DRAFT` + `ACTIVE` của HLV không vượt quá 8 giáo án.
- **Chuẩn hóa dữ liệu đầu vào**:
  - Tên giáo án: Không được đặt hoàn toàn bằng số và phải chứa chữ cái (`INVALID_PLAN_NAME`).
  - Mục tiêu giáo án: Bắt buộc bắt đầu bằng chữ cái, không được bắt đầu bằng số hay ký tự đặc biệt (`INVALID_OBJECTIVE`).
  - Thời lượng giáo án: Tối đa 52 tuần (`MAX_PLAN_WEEKS = 52`). Ngày bắt đầu phải từ ngày mai trở đi (`assertStartsFromTomorrow`).

### 3.3. Cấu trúc Giai đoạn Huấn luyện (Phases Validation):
Một giáo án bao gồm từ **1 đến 12 giai đoạn** (`MAX_PHASES = 12`), kiểm tra nghiêm ngặt qua hàm `validatePhases`:
- **5 Loại giai đoạn sinh lý (`PHASE_TYPES`)**:
  1. `BASE`: Xây dựng nền tảng thể lực cơ bản.
  2. `BUILD`: Phát triển cơ bắp và sức bền tim mạch.
  3. `SPEED`: Rèn luyện tốc độ bứt phá.
  4. `PRE_RACE`: Giai đoạn siết cơ, chuẩn bị thi đấu.
  5. `RECOVERY`: Phục hồi thể trạng sau thi đấu hoặc sau đợt tập nặng.
- **3 Loại mặt sân (`PHASE_SURFACES`)**: `TURF` (Sân cỏ), `DIRT` (Sân cát), `SYNTHETIC` (Mặt sân tổng hợp).
- **Ràng buộc định lượng mỗi giai đoạn**:
  - Số buổi mỗi tuần: từ 1 đến 14 buổi/tuần (`sessionsPerWeek`).
  - Cự ly tích lũy tuần: từ 500m đến 60.000m/tuần (`maxWeeklyDistance`).
  - Tốc độ mục tiêu: từ 10 đến 70 km/h (`targetSpeedKmh`).
  - Mục tiêu giai đoạn: Tối đa 500 ký tự.
  - **Thời lượng tối thiểu**: Giáo án ngắn (< 14 ngày) thì mỗi phase tối thiểu 3 ngày; giáo án dài thì phase `PRE_RACE` và `RECOVERY` tối thiểu 3 ngày, các phase rèn luyện còn lại (`BASE`, `BUILD`, `SPEED`) tối thiểu **7 ngày (1 tuần)**.
  - **Ràng buộc không giao thoa thời gian (`PHASE_OVERLAP`)**: `phases[i].startDate > phases[i-1].endDate`. Nếu ngày bắt đầu của phase sau đè lên thời gian của phase trước → Hệ thống chặn đứng, ném lỗi `PHASE_OVERLAP: "Giai đoạn bị trùng thời gian với giai đoạn [Tên phase trước]"`.

### 3.4. Kích hoạt Giáo án (`ACTIVE`) & Tịnh tiến Lịch tập tự động (`shiftMs`):
- **Điều kiện kích hoạt bắt buộc (`assertCanActivate`)**:
  - Chỉ kích hoạt từ trạng thái `DRAFT` (`INVALID_PLAN_TRANSITION`).
  - Chiến mã không bị Khóa y tế (`MEDICAL_LOCK_ACTIVE`).
  - Chiến mã chưa có giáo án `ACTIVE` nào khác (`HORSE_HAS_ACTIVE_PLAN`).
  - Giáo án phải có **ít nhất 1 buổi tập** (`PLAN_HAS_NO_WORKOUTS`).
  - Giáo án phải có **ít nhất 1 buổi tập khả thi trong tương lai** từ hôm nay trở đi (`NO_UPCOMING_SCHEDULED_WORKOUTS`).
  - Ngày kết thúc của giáo án không được nằm trong quá khứ (`PLAN_ENDED`).
  - Nếu ngựa đang ở trạng thái y tế đặc biệt (`INJURED`, `QUARANTINED`, `UNDER_OBSERVATION`), HLV bắt buộc phải tích xác nhận đã tham vấn Bác sĩ thú y (`VET_CONFIRMATION_REQUIRED` / `dto.vetConsulted = true`).
- **Thuật toán Tịnh tiến Lịch tập (`shiftMs`)**:
  - Nếu ngày kích hoạt thực tế trễ hơn so với ngày dự kiến ban đầu trong bản nháp:
    > **Độ lệch tịnh tiến:** `shiftMs = targetStartDate - plan.startDate`
  - Backend tự động cộng `shiftMs` vào toàn bộ ngày bắt đầu/kết thúc của các Phase và dời ngày diễn ra của toàn bộ các buổi tập con (`workoutSession.scheduledDate`), bảo đảm không có buổi tập nào bị rơi vào quá khứ.
- **Chuyển đổi trạng thái ngựa**: Khi kích hoạt giáo án, trạng thái chiến mã tự động chuyển từ `RESTING` → `IN_TRAINING`.

### 3.5. Chỉnh sửa Giáo án đang chạy (`updatePlan`):
- H-14: Không cho phép thu hẹp thời gian giáo án nếu có buổi tập ĐÃ HOÀN THÀNH nằm ngoài khoảng ngày mới (`CANNOT_EXCLUDE_COMPLETED_WORKOUTS`).
- Giai đoạn đã có buổi tập hoàn thành thì không được xóa và bắt buộc giữ nguyên ngày bắt đầu (`PHASE_HAS_COMPLETED_WORKOUTS`).

### 3.6. Hoàn thành Giáo án (`COMPLETED`) & Cơ chế Miễn trừ SLA (`isRestingCycle`):
- **Điều kiện kết thúc**:
  - Bắt buộc nhập báo cáo nhận xét tổng kết từ 10 đến 2000 ký tự (`SUMMARY_REQUIRED`).
  - Kiểm tra các buổi tập chưa ghi kết quả (`unfinished`). Nếu còn buổi tập nào chưa hoàn tất → Chặn ném lỗi `409 CONFLICT: PLAN_WORKOUT_RESULTS_REQUIRED`: *"Còn [X] buổi tập chưa ghi kết quả: [Danh sách ngày]"*.
- **Tự động đưa ngựa về Nghỉ ngơi**: Khi giáo án hoàn tất, ngựa tự động chuyển từ `IN_TRAINING` về `RESTING`.
- **Cơ chế Miễn trừ SLA (`isRestingCycle`)**:
  - Hệ thống tự động gán `isRestingCycle = true` và `planDeadlineAt = null`.
  - Dashboard HLV hiển thị Badge xanh lá **`Nghỉ ngơi hồi phục`**, **miễn trừ hoàn toàn nghĩa vụ SLA 3 ngày**, giải phóng nghĩa vụ của lần bàn giao trước để ngựa phục hồi thể trạng sau giải thi đấu.

---

## 4. QUY TRÌNH 3: LẬP LỊCH, XẾP CA & KIỂM SOÁT XUNG ĐỘT (WORKOUT SCHEDULING)
*Tệp nguồn: `BE/src/training/workouts.service.ts`, `BE/src/training/tracks.service.ts`, `BE/src/training/training-rules.ts`, `FE/src/features/training/components/WorkoutDialogs.tsx`*

### 4.1. Phân loại 7 Bài tập & Thời lượng Tiêu chuẩn:
| Mã bài tập | Tên bài tập | Thời lượng tiêu chuẩn | Quy chuẩn Cường độ | Quy chuẩn Mặt sân |
| :--- | :--- | :---: | :---: | :---: |
| `WALK` | Đi bộ thư giãn | **45 phút** | Nhẹ (`LIGHT`) | Cỏ / Cát / Tổng hợp |
| `TROT` | Chạy nước kiệu | **60 phút** | Nhẹ / Vừa (`LIGHT`/`MEDIUM`) | Cỏ / Cát / Tổng hợp |
| `CANTER` | Chạy nước đại nhẹ | **60 phút** | Vừa (`MEDIUM`) | Cỏ / Cát / Tổng hợp |
| `BREEZE` | Chạy tốc độ cao | **60 phút** | **Luôn ép thành Nặng (`HEAVY`)** | Cỏ / Cát / Tổng hợp |
| `TRIAL` | Chạy thử sát hạch | **90 phút** | **Luôn ép thành Nặng (`HEAVY`)** | Cỏ / Cát / Tổng hợp |
| `SWIM` | Bơi phục hồi | **45 phút** | Nhẹ / Vừa | **Ép thành `NONE` (Khu bể bơi)** |
| `TREADMILL` | Máy đi bộ trên cạn | **60 phút** | Nhẹ / Vừa | **Ép thành `NONE` (Khu máy tập)** |

### 4.2. Cơ chế HLV Tự dẫn tập & Kiêm nài (Quy tắc #4, #7):
- *Tệp nguồn:* `BE/src/training/workouts.service.ts#L302-L315`, `FE/WorkoutDialogs.tsx#L914-L915`
- Trong phân hệ Huấn luyện EquiFlow, **HLV của giáo án trực tiếp dẫn dắt buổi tập và kiêm luôn vai trò Nài ngựa (Jockey)**.
- Form lên lịch buổi tập **hoàn toàn không có trường chọn Groom**. Hệ thống tự động gán ngầm:
  ```typescript
  w.assignedStaffUserId = trainer.id;
  w.jockeyName = trainer.fullName;
  ```
- Nhân viên chăm sóc (Groom) chỉ phụ trách các công việc tĩnh tại khu chuồng trại (cho ăn, dọn phân, tắm rửa định kỳ tại chuồng). Groom không tham gia dẫn tập hay nài ngựa trên đường chạy.

### 4.3. Dòng thời gian Sinh hoạt của Ngựa (Daily Routine Timeline):
Hệ thống đối chiếu lịch sinh hoạt tự nhiên của chiến mã để khuyến nghị khung giờ tập luyện tối ưu:
- `05:30 – 06:15`: Ngựa ăn sáng (Sinh hoạt Groom).
- **`06:15 – 11:30`**: **Khung rảnh sáng (Morning Slot)** → **Khuyên dùng (Recommended 🟢)**.
- `11:30 – 13:30`: Ngựa ăn trưa & nghỉ trưa (Sinh hoạt Groom).
- `13:30 – 14:15`: Tắm xả cơ & chăm sóc móng (Chăm sóc Groom).
- **`14:30 – 17:00`**: **Khung rảnh chiều (Afternoon Slot)** → **Khả dụng (Available 🟢)**.
- `18:00 – 19:00`: Ngựa ăn tối & nghỉ đêm (Sinh hoạt Groom).

### 4.4. Quy chuẩn Khung giờ Tập luyện & Chốt chặn Sinh học Bắt buộc:
1. **Khung giờ mở cửa hạ tầng khuôn viên CLB**:
   - Từ **04:00 đến 20:00** (`FIRST_HOUR = 4`, `LAST_HOUR = 20` tại `training-rules.ts#L146-L147`).
   - Đây là khung giờ hoạt động chung của toàn bộ hạ tầng (chuồng trại, văn phòng, an ninh). Nếu chọn giờ ngoài khung này → Ném lỗi `OUTSIDE_TRAINING_HOURS`: *"Giờ bắt đầu phải từ 04:00 đến 20:00."*
2. **Khung giờ Huấn luyện Chiến mã thực tế (Bắt đầu muộn nhất lúc 16:00 chiều)**:
   - *Tệp nguồn:* `BE/src/training/workouts.service.ts#L253-L259`
   - Buổi tập bắt buộc phải **kết thúc trước hoặc đúng 17:00 chiều** (`startMins + durMins <= 17 * 60`).
   - *Quy chuẩn sinh học:* Sau 17:00 chiều là thời gian bắt buộc dành cho chiến mã hạ nhiệt, tắm rửa xả cơ và ăn tối (`17:00 - 18:00`), sau đó nghỉ đêm. Tuyệt đối không cho phép bất kỳ buổi tập nào kéo dài qua 17:00.
   - Do bài tập tiêu chuẩn kéo dài từ 45 đến 60 phút, **thời điểm bắt đầu muộn nhất được phép xếp lịch trong ngày là 16:00 (4h chiều)**.
   - Nếu vi phạm (kết thúc sau 17:00) → Hệ thống chặn ném lỗi `EXCEEDS_AFTERNOON_LIMIT`: *"Buổi tập phải kết thúc trước hoặc đúng 17:00 chiều để đảm bảo giờ nghỉ ngơi và ăn tối của ngựa. Giờ bắt đầu muộn nhất là 16:00."*
   - Trên Giao diện xếp lịch (`WorkoutDialogs.tsx`), thẻ chọn giờ bị khống chế cứng `min="04:00" max="16:00"` để HLV không thể chọn sai.
3. **Khung giờ vàng (`Prime Time`: 06:15 - 08:00)**:
   - Thời điểm thời tiết mát mẻ nhất buổi sáng, mỗi HLV bị khống chế **tối đa 2 buổi tập nặng** (`MAX_PRIME_HEAVY_SESSIONS_PER_TRAINER = 2`) để công bằng tài nguyên đường chạy cho các HLV khác. Vượt quá 2 bài → Ném lỗi `PRIME_TIME_QUOTA_EXCEEDED`.
   - **Các khung giờ khác trong ngày (08:15 - 16:00)**: HLV được phép xếp thêm bài tập nặng khác bình thường, không bị giới hạn bởi hạn ngạch 2 bài của giờ vàng, miễn là đường chạy còn chỗ và cách ca trước tối thiểu 15 phút.

### 4.5. Ràng buộc Xung đột Thời gian (Conflict Checks):
1. **Đệm thời gian của Huấn luyện viên (`TRAINER_BUFFER_MINUTES = 15`)**:
   - Một HLV chỉ điều hành 1 buổi tập tại 1 thời điểm (`BE/src/training/workouts.service.ts#L348`).
   - Giữa 2 ca tập liên tiếp của cùng 1 HLV bắt buộc phải có thời gian nghỉ đệm tối thiểu **15 phút**.
   - Nếu vi phạm → Ném lỗi `TRAINER_TIME_CONFLICT`: *"Huấn luyện viên [Tên] đã có buổi tập của ngựa [Tên ngựa] lúc [Giờ]. HLV chỉ có thể điều hành 1 buổi tập tại một thời điểm. Chọn giờ bắt đầu từ [Trước] trở về trước hoặc từ [Sau] trở đi."*
2. **Trùng giờ tập của Chiến mã (`HORSE_WORKOUT_TIME_CONFLICT`)**:
   - Một chiến mã không thể tham gia 2 buổi tập cách nhau dưới 30 phút (`BE/src/training/workouts.service.ts#L327`). Nếu vi phạm → Ném lỗi `HORSE_WORKOUT_TIME_CONFLICT`.
3. **Thời điểm tạo lịch trong ngày hôm nay (`TIME_TOO_SOON`)**:
   - Nếu tạo buổi tập diễn ra trong ngày hôm nay, giờ bắt đầu phải sau thời gian hiện tại **ít nhất 30 phút** (`scheduledDate >= now + 29 phút`).

### 4.6. Chọn Mặt sân & Kiểm soát Sức chứa Đường chạy (Track Capacity):
*Hàm kiểm tra `checkTrackAvailability` tại `BE/src/training/tracks.service.ts#L81`*
- **Luồng chọn Mặt sân và Đường chạy trên UI**:
  - HLV chọn **Mặt sân** (`effSurface`: `TURF` Cỏ, `DIRT` Cát, `SYNTHETIC` Tổng hợp, hoặc `NONE` nếu là Bơi/Máy đi bộ).
  - Dựa vào Mặt sân đã chọn, dropdown `TrainingTrackPicker` lọc danh sách các **Đường chạy thực tế** (`TrainingTrack`) trong CLB để HLV chọn đường chạy cụ thể (`trackId`).
- **Kiểm soát Sức chứa theo từng Đường chạy cụ thể (`track.capacity`)**:
  - **Đối với bài tập Nhẹ / Vừa (`WALK`, `TROT`, `CANTER`)**: Mỗi đường chạy có định mức sức chứa riêng trong CSDL (`track.capacity`, ví dụ Đường cỏ A sức chứa 6 ngựa, Đường cỏ B sức chứa 4 ngựa). Đường chạy chỉ bị đầy khi số lượng ngựa cùng tập `count >= track.capacity`.
  - **Đối với bài tập Nặng (`BREEZE`, `TRIAL`, `HEAVY`)**: Áp dụng cơ chế **Chiếm dụng độc quyền (`HEAVY_OCCUPIED`)**. Khi có 1 chiến mã đang chạy tốc độ, đường chạy đó bị khóa 100%, cấm tất cả các ngựa khác vào cùng đường chạy đó trong khung giờ đó để loại trừ triệt để nguy cơ tai nạn va chạm ở vận tốc cao.

---

## 5. QUY TRÌNH 4: THỰC THI BUỔI TẬP & GHI NHẬN CHỈ SỐ SINH TRẮC (SESSION EXECUTION & TELEMETRY)
*Tệp nguồn: `BE/src/training/workouts.service.ts` (`startWorkout`, `recordResult`), `BE/src/training/training-rules.ts`*

### 5.1. Bắt đầu Buổi tập (`startWorkout`):
- **Chốt chặn y tế**: Kiểm tra `checkMedicalLock(horseId, workoutDate)`. Nếu ngựa đang có Khóa y tế hiệu lực → Chặn đứng, ném lỗi `400 BAD_REQUEST: MEDICAL_LOCK_ACTIVE`.
- **Chốt chặn thời gian**: Chỉ được bấm Bắt đầu khi đến giờ tập thực tế (trừ khi bật cờ môi trường test dev `allowEarlyWorkoutStart()`).
- Trạng thái buổi tập chuyển sang `IN_PROGRESS`.

### 5.2. Ghi nhận Chỉ số Sinh trắc học & Thể lực (`recordResult`):
- **Thời hạn ghi kết quả**: Tối đa trong vòng **7 ngày** kể từ khi buổi tập diễn ra (`LATE_RESULT_DAYS = 7`). Quá 7 ngày → Ném lỗi `LATE_RESULT_EXPIRED`: *"Đã quá 7 ngày, không thể ghi kết quả cho buổi tập bỏ lỡ."*
- **Thời hạn chỉnh sửa kết quả**: Chỉ được phép sửa kết quả trong vòng **48 giờ** kể từ lần ghi đầu tiên (`RESULT_EDIT_HOURS = 48`). Quá 48h → Ném lỗi `RESULT_EDIT_EXPIRED`.
- **Giới hạn kiểm tra tính hợp lý sinh học (Sanity Checks)**:
  - Cự ly thực tế: Tối đa **10.000 mét / buổi** (`MAX_SESSION_DISTANCE_METERS = 10000`).
  - Vận tốc trung bình tính toán: `averageSpeedKmh = (actualDistanceMeters / actualTimeSeconds) * 3.6`. Tối đa **75 km/h** (`MAX_AVERAGE_SPEED_KMH = 75` - do kỷ lục thế giới của loài ngựa đua xấp xỉ 70 km/h; vượt quá 75 km/h là dữ liệu nhập sai, ném lỗi `IMPLAUSIBLE_SPEED`).
  - Tốc độ bứt phá cao nhất: Không được nhỏ hơn tốc độ trung bình (`TOP_SPEED_BELOW_AVERAGE`).
  - Dải nhịp tim chuẩn:
    - Nhịp tim nghỉ trước tập: 28 – 45 bpm.
    - Nhịp tim đỉnh khi tập nặng: 120 – 240 bpm.
    - Nhịp tim hồi phục sau 10-15 phút: Không được lớn hơn nhịp tim đỉnh (`RECOVERY_ABOVE_PEAK`).
  - Điểm số phong độ (`performanceScore`): Thang điểm chuẩn từ 0 đến 100 điểm.
- **Dấu hiệu Bất thường & Liên động Thú y (`abnormalSigns`)**:
  - Nếu phát hiện dấu hiệu bất thường (`LAMENESS` què chân, `PROLONGED_BREATHING` thở dốc kéo dài, `NOSEBLEED` chảy máu mũi, `LEG_SWELLING` sưng khớp, `OFF_FEED` bỏ ăn) → Bắt buộc phải nhập mô tả chi tiết (`ABNORMAL_NOTES_REQUIRED`).
  - Hệ thống tự động bắn **Thông báo khẩn cấp real-time** tới Bác sĩ thú y (`notifyRoles([Role.VETERINARIAN])`) với tiêu đề `Abnormal signs after a workout` để Bác sĩ thú y kiểm tra ngay nguy cơ chấn thương.
- **Cảnh báo Mệt mỏi quá tải (`Exertion Alert`)**:
  - Nếu nhịp tim sau 15 phút nghỉ vẫn > 115 bpm → Hệ thống tự động gắn cờ Cảnh báo mệt mỏi quá tải (`Exertion Alert`) trên Sidebar của HLV.

### 5.3. Hủy Buổi tập (`cancelWorkout`):
- Chỉ hủy được buổi tập chưa hoàn thành (`SCHEDULED`, `BLOCKED`, `MISSED`).
- Nếu lý do hủy là `OTHER` → Bắt buộc nhập giải trình từ 10 đến 500 ký tự (`NOTE_REQUIRED`).

---

## 6. QUY TRÌNH 5: CƠ CHẾ LIÊN ĐỘNG KHÓA Y TẾ (MEDICAL LOCK INTERLOCK)
*Tệp nguồn: `BE/src/health/health.service.ts`, `BE/src/training/workouts.service.ts`, `training-common.service.ts`*

Khi Bác sĩ thú y (`Role.VETERINARIAN`) chẩn đoán ngựa có vấn đề sức khỏe và kích hoạt lệnh Khóa y tế (`placeLock`):

```
       [Bác sĩ Thú y đặt Khóa y tế]
                    │
                    ▼
     ┌──────────────────────────────┐
     │  Horse.isMedicalLocked = true│
     └──────────────┬───────────────┘
                    │
       Cơ chế Khóa liên động (Interlock)
                    │
     ┌──────────────┴──────────────┐
     ▼                             ▼
[Tại Module Huấn luyện]     [Tại Dashboard HLV]
- Chặn tạo Plan mới          - Hiển thị Badge đỏ "Khóa y tế"
- Chặn kích hoạt Plan        - Khóa nút "Bắt đầu tập"
- Chặn bấm Start Workout     - Chuyển thành nút "Xem bệnh án"
- Tự động hoãn bài nặng
```

1. **Khóa quyền Lập giáo án mới**: Tại `createPlan`, ném lỗi `409 CONFLICT: HORSE_MEDICAL_LOCKED`: *"Ngựa đang bị Khóa huấn luyện y tế. Không thể tạo giáo án mới cho đến khi Bác sĩ thú y gỡ khóa."*
2. **Khóa quyền Kích hoạt giáo án**: Tại `activatePlan`, ném lỗi `409 CONFLICT: MEDICAL_LOCK_ACTIVE`.
3. **Khóa quyền Bắt đầu Buổi tập**: Tại API `startWorkout`, Backend kiểm tra hàm `checkMedicalLock`. Nếu phát hiện khóa đang active → Ném lỗi `400 BAD_REQUEST: MEDICAL_LOCK_ACTIVE`, ngăn chặn 100% việc HLV ép ngựa ốm/chấn thương ra sân.
4. **Tự động Hoãn/Chặn bài tập nặng**: Các buổi tập `HEAVY`, `BREEZE`, `TRIAL` đã lên lịch trong thời gian khóa y tế tự động chuyển sang trạng thái `BLOCKED`.
5. **Giải phóng Khóa y tế**: Chỉ duy nhất Bác sĩ thú y có quyền gỡ khóa (`liftLock`) sau khi khám tái thẩm định. Khi khóa được gỡ, các bài tập mới được mở khóa trở lại.

---

## 7. QUY TRÌNH 6: SÁT HẠCH CHẠY THỬ & ĐĂNG KÝ THI ĐẤU (TRIAL RUNS & RACE READINESS)
*Tệp nguồn: `FE/src/features/training/pages/TrialRunsPage.tsx`, `FE/src/features/training/lib/readiness.ts`*

### 7.1. Buổi Chạy thử Sát hạch (`Trial Run`):
- Thời lượng: 90 phút (bài tập chuyên sâu nặng nhất hệ thống).
- Đo đạc chính thức 3 cự ly chuẩn thi đấu quốc tế: **1000m, 1200m, 1600m**.
- Ghi nhận chỉ số Vận tốc bứt phá cực đại (**Top Speed**) và thời gian hoàn thành (giây).

### 7.2. Bảng Thẩm định 4 Trụ cột Sẵn sàng Thi đấu (`evaluateReadiness`):
Chiến mã chỉ được cấp trạng thái Đủ điều kiện đăng ký thi đấu (`isEligible = true`) khi thỏa mãn đồng thời **4/4 tiêu chí khắt khe**:
1. **Tiêu chí Y tế (`healthOk`)**: Không có Khóa y tế (`isMedicalLocked === false`), không ở trạng thái ốm/chấn thương (`INJURED`, `ISOLATED`, `UNDER_OBSERVATION`), không bị tạm giữ do nợ tiền chuồng (`isDebtImpounded === false`), không ngừng quản lý (`RETIRED`).
2. **Tiêu chí Giáo án (`planOk`)**: Có giáo án `ACTIVE`, tiến độ hoàn thành đạt **≥ 80%** tổng số bài tập (hoặc đã hoàn thành tích lũy ≥ 8 bài tập).
3. **Tiêu chí Phong độ Chạy thử (`scoreOk`)**: Có ít nhất 1 bài Chạy thử sát hạch (`Trial Run`) với điểm số đánh giá phong độ đạt **≥ 7.0 / 10** (tương đương ≥ 70 / 100 điểm) và vận tốc bứt phá cực đại Top Speed ≥ 50 km/h.
4. **Tiêu chí An toàn Tải trọng (`loadOk`)**: Không có cảnh báo gai tải (`loadSpike === false`), tổng tải trọng 7 ngày gần nhất không vượt quá **130%** (`LOAD_SPIKE_RATIO = 1.3`) so với mức tải trung bình tuần của 4 tuần trước đó.

---

## 8. QUY TRÌNH 7: MINH BẠCH ĐÁNH GIÁ TỪ CHỦ NGỰA (TRAINER REVIEWS)
*Tệp nguồn: `BE/src/training/trainer-reviews.service.ts`, `FE/src/features/training/pages/TrainerReviewsPage.tsx`*

- **Phân quyền Một chiều**:
  - Chủ sở hữu ngựa (`Role.HORSE_OWNER`) có quyền gửi đánh giá từ 1 đến 5 sao kèm nhận xét cho Huấn luyện viên đối với các giáo án đang áp dụng (`ACTIVE`) hoặc đã hoàn thành (`COMPLETED`).
  - HLV Trưởng chỉ có quyền **Xem đánh giá (`My Reviews`)**, hoàn toàn **KHÔNG có quyền can thiệp, chỉnh sửa hay xóa đánh giá**.
- **Chỉ số đánh giá uy tín HLV**:
  - Điểm trung bình cộng sao (Average Rating).
  - Tỷ lệ hoàn thành giáo án đúng hạn SLA.
  - Tỷ lệ chiến mã đạt chuẩn sát hạch thi đấu thành công.

---

## 9. BẢNG MA TRẬN THAM SỐ & HẰNG SỐ NGHIỆP VỤ CỐT LÕI (BUSINESS RULE MATRIX)

| Tên Hằng số / Quy tắc | Giá trị Chuẩn | Tệp nguồn trong Code | Ý nghĩa Nghiệp vụ & Cơ sở Khoa học |
| :--- | :---: | :--- | :--- |
| `MAX_HORSES_PER_TRAINER` | **8** | `BE/src/training/training-rules.ts#L69` | Định mức tối đa 8 ngựa / 1 HLV để đảm bảo chất lượng huấn luyện. |
| `WIP Limit (Pending Plans)` | **2** | `BE/src/horses/horses.service.ts#L2310` | HLV tồn ≥ 2 ngựa chưa kích hoạt giáo án thì bị chặn không cho nhận thêm ngựa. |
| `MAX_TRAINERS_PER_BARN` | **2** | `BE/src/training/training-rules.ts#L72` | Mỗi Khu chuồng chỉ bố trí tối đa 2 HLV để tránh xung đột quản lý. |
| `HANDOVER_SLA_HOURS` | **48h** | `BE/src/horses/horses.service.ts#L2316` | Thời hạn tối đa để HLV bấm Tiếp nhận hoặc Từ chối ngựa quản lý giao. |
| `PLAN_CREATION_SLA_DAYS` | **3 ngày (72h)** | `BE/src/horses/horses.service.ts#L2476` | Hạn cố định 72 giờ để HLV lập và kích hoạt giáo án sau khi nhận ngựa. |
| `FIRST_HOUR` - `LAST_HOUR` | **04:00 - 20:00** | `BE/src/training/training-rules.ts#L146` | Khung giờ mở cửa hoạt động hạ tầng chuồng trại của CLB. |
| `EXCEEDS_AFTERNOON_LIMIT` | **16:00 (kết thúc ≤ 17:00)** | `BE/src/training/workouts.service.ts#L253` | Buổi tập muộn nhất bắt đầu lúc 16:00 (4h chiều), kết thúc trước 17:00 để ngựa ăn tối. |
| `PRIME_TIME` | **06:15 - 08:00** | `BE/src/training/training-rules.ts#L80` | Khung giờ vàng buổi sáng, khống chế tối đa 2 bài tập nặng / HLV. |
| `TRAINER_BUFFER_MINUTES` | **15 phút** | `BE/src/training/training-rules.ts#L75` | Thời gian đệm nghỉ tối thiểu giữa 2 ca tập của HLV (HLV tự dẫn tập & kiêm nài). |
| `HLV Kiêm Nài (#4, #7)` | **Tự động gán trainer.id** | `BE/src/training/workouts.service.ts#L314` | HLV tự dẫn buổi tập và cưỡi luôn, không phân công Groom khi lên lịch. |
| `track.capacity` | **4 - 6 ngựa** (theo DB) | `BE/src/training/tracks.service.ts#L81` | Sức chứa tối đa của từng đường chạy cụ thể cho các bài tập nhẹ/vừa. |
| `HEAVY_OCCUPIED` | **1 ngựa** | `BE/src/training/tracks.service.ts#L81` | Bài tập nặng chiếm dụng độc quyền đường chạy, cấm các ngựa khác vào cùng giờ. |
| `MAX_SESSION_DISTANCE_METERS`| **10.000m** | `BE/src/training/training-rules.ts#L141` | Cự ly tối đa cho phép trong 1 buổi tập để chống nhập khống. |
| `MAX_AVERAGE_SPEED_KMH` | **75 km/h** | `BE/src/training/training-rules.ts#L143` | Tốc độ tối đa giới hạn sinh học loài ngựa đua (kỷ lục thế giới ≈ 70 km/h). |
| `LATE_RESULT_DAYS` | **7 ngày** | `BE/src/training/training-rules.ts#L145` | Hạn chót HLV phải nhập kết quả sau khi buổi tập kết thúc. |
| `RESULT_EDIT_HOURS` | **48 giờ** | `BE/src/training/workouts.service.ts#L1193`| Hạn chót HLV được phép chỉnh sửa kết quả buổi tập sau khi lưu lần đầu. |
| `MAX_PHASES` | **12** | `BE/src/training/training-rules.ts#L185` | Số giai đoạn tối đa trong 1 giáo án huấn luyện. |
| `MAX_PLAN_WEEKS` | **52 tuần** | `BE/src/training/training-rules.ts#L186` | Thời lượng tối đa của một giáo án (1 năm). |
| `LOAD_SPIKE_RATIO` | **130% (1.3)** | `BE/src/training/training-rules.ts#L326` | Ngưỡng cảnh báo gai tải trọng 7 ngày so với trung bình 4 tuần trước. |
| `TRAINER_COOLDOWN_HOURS` | **48 giờ** | `BE/src/training/training-plans.service.ts#L978` | Thời gian chờ nếu HLV hủy nháp hoặc để hết hạn nháp đối với ngựa đó. |
| `CLUB_UTC_OFFSET_HOURS` | **UTC+7** | `BE/src/training/training-rules.ts#L152` | Quy đổi múi giờ chuẩn Việt Nam, loại bỏ sai lệch ngày giờ hệ thống. |
