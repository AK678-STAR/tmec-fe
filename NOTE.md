# Ghi Chú Dự Án & Ý Tưởng Tối Ưu Giao Diện Groom (Nhân Viên Chăm Sóc)

> **Mục đích:** Lưu trữ các giải pháp tái cấu trúc giao diện Lịch trực và Công việc hàng ngày dành riêng cho nhân viên Groom (khắc phục nhược điểm của ma trận dạng lưới tuần của Quản lý).

---

## 1. Phân Tích Bối Cảnh Thực Tế Của Groom (User Persona & Pain Points)

- **Môi trường thao tác:** Hoạt động trực tiếp tại khu chuồng trại (Barn A, B, C, H), lối đi sân cát, paddock.
- **Thiết bị sử dụng:** Điện thoại thông minh hoặc máy tính bảng gắn trên xe đẩy vật tư.
- **Điều kiện làm việc:** 
  - Thường xuyên đeo găng tay bảo hộ hoặc tay dính nước/bụi cám cỏ.
  - Ánh sáng tự nhiên ngoài trời chói lóa hoặc ánh đèn hành lang chuồng.
- **Nỗi đau với UI Ma Trận Tuần Hiện Tại (`ShiftRosterPage.tsx`):**
  - Ma trận 7 ngày $\times$ Phân khu chuồng có quá nhiều thông tin thừa (Groom không cần biết ai trực thứ 6 tuần sau ở Barn C).
  - Các ô lưới bảng quá nhỏ, dễ chạm nhầm khi đang di chuyển hoặc đeo găng tay.
  - Không nhìn thấy ngay danh sách đàn ngựa mình phải cho ăn / dọn dẹp trong 30 phút tới.

---

## 2. Đề Xuất 4 Ý Tưởng Giao Diện Chuyên Biệt Cho Groom

### Ý tưởng 1: Chế độ xem "Ca trực hôm nay của tôi" (My Shift Today - Timeline Card)
- **Đặc điểm:** Tự động nhận diện `user.role === 'GROOM'` để hiển thị giao diện thẻ tóm tắt (Hero Card) thay vì ma trận tuần.
- **Nội dung thẻ chính:**
  - **Ca trực hiện tại:** Ví dụ: *🌅 Ca Sáng (06:00 - 14:00)*.
  - **Phân khu phụ trách:** *📍 Barn A - Ô chuồng tiêu chuẩn*.
  - **Nút hành động lớn (CTA):** `[ Bắt đầu ca trực ]` / `[ Hoàn thành ca trực ]`.
  - **Đồng hồ đếm ngược:** Thời gian còn lại trong ca.

### Ý tưởng 2: Thẻ Đàn Ngựa Trực Diện Kèm Huy Hiệu Cảnh Báo (Assigned Horses Quick-Pills)
- Hiển thị danh sách 5–8 con ngựa trong khu vực được phân công dưới dạng thẻ ngang (Horizontal Cards):
  - **Mã ô chuồng:** `STALL-A01`, `STALL-A02`...
  - **Tên ngựa & Hình ảnh thu nhỏ**.
  - **3 Huy hiệu cảnh báo nghiệp vụ bắt buộc:**
    - 🔴 **Khóa Y Tế (`MedicalLock`):** Cảnh báo không dắt ngựa ra sân tập nặng / giải đua.
    - 💊 **Uống thuốc / Chườm đá:** Bác sĩ thú y đã kê đơn trong ca trực.
    - 🥕 **Khẩu phần ăn đặc biệt:** Cảnh báo lượng cỏ/cám đặc thù (tránh bội thực colic).

### Ý tưởng 3: Bảng Công Việc 1-Chạm (Touch-Friendly Checklist 48px+)
- Các nút checkbox/toggle được tăng kích thước tối thiểu **$48\text{px} \times 48\text{px}$** để bấm nhạy khi đeo găng tay.
- Phân nhóm việc theo 3 giai đoạn của ca trực:
  1. **Đầu ca (06:00 - 08:00):** Vệ sinh máng nước, dọn phân & thay rơm lót chuồng.
  2. **Giữa ca (08:00 - 11:30):** Cân và cho ăn định lượng (1.5% - 3.0% khối lượng cơ thể), dắt ngựa thả lỏng paddock.
  3. **Cuối ca (11:30 - 14:00):** Kiểm tra thân nhiệt, chốt cửa chuồng an toàn, bàn giao ca chiều.

### Ý tưởng 4: Nút "Xin Đổi Ca / Bàn Giao Nhanh" (Shift Swap Request)
- Groom chỉ cần nhấn 1 nút duy nhất: `[ Xin đổi ca trực này ]`.
- Dropdown hiển thị danh sách đồng nghiệp rảnh trong ca đó $\to$ Nhập lý do ngắn $\to$ Hệ thống tự động gửi thông báo duyệt đến Quản lý (`CLUB_MANAGER`).

---

## 3. Kiến Trúc Kỹ Thuật Đề Xuất Để Hiện Thực Hóa
- **File FE mục tiêu:**
  - `Racehorse_Training_Management_System_MT_FE/src/features/stable/pages/GroomTodayShiftPage.tsx` (hoặc switch view theo role trong `ShiftRosterPage.tsx`).
  - `Racehorse_Training_Management_System_MT_FE/src/features/stable/components/GroomHorseCard.tsx`.
- **API BE sử dụng:**
  - `GET /api/shifts/my-shifts` (lấy ca trực cá nhân của Groom đăng nhập).
  - `GET /api/daily-care-tasks/today` (lấy danh sách công việc chăm sóc ngựa theo ô chuồng).

---

## 4. Kế Hoạch Triển Khai PWA (Progressive Web App) & Web Push Notifications (OneSignal) (Lưu Trữ / Tạm Hoãn)

> [!NOTE]
> **Trạng thái:** TẠM HOÃN / LƯU TRỮ Ý TƯỞNG THAM KHẢO (Đã gỡ bỏ khỏi mã nguồn Frontend, chỉ lưu lại thiết kế trong tài liệu này để tham khảo khi cần mở rộng sau).

> **Mục tiêu:** Biến website `https://tmec.site` thành một ứng dụng độc lập trên điện thoại di động dành cho Groom, Huấn luyện viên, Bác sĩ thú y và Chủ ngựa. Người dùng có thể cài đặt trực tiếp từ trình duyệt ra màn hình chính (Home Screen) và nhận Thông báo đẩy (Push Notifications) hoàn toàn miễn phí mà không cần đưa lên App Store hay đóng phí Apple Developer (\$99/năm).

### 4.1 Giá Trị Nghiệp Vụ & Bối Cảnh
- **Trải nghiệm như App thật (Standalone Mode):** Chạy toàn màn hình, không bị vướng thanh URL của trình duyệt, có icon và màn hình splash screen thương hiệu TMEC riêng biệt.
- **Nhận thông báo sự cố tức thì:** Khi có ca trực mới, lệnh Khóa Y Tế (`MedicalLock`), hoặc ngựa gặp sự cố chấn thương, điện thoại nhân viên sẽ rung và hiện banner thông báo ngay cả khi đã đóng trình duyệt.
- **Tiết kiệm chi phí:** Sử dụng gói miễn phí của **OneSignal** (không giới hạn lượt gửi thông báo qua Web Push API).

### 4.2 Kiến Trúc & Các File Cần Thiết Lập

1. **File cấu hình PWA (`public/manifest.json`):**
   - Định nghĩa tên ứng dụng: `"name": "TMEC - Quản Lý Huấn Luyện Ngựa Đua"`, `"short_name": "TMEC"`.
   - Chế độ hiển thị: `"display": "standalone"`.
   - Màu sắc chủ đạo: `"theme_color": "#10b981"`, `"background_color": "#ffffff"`.
   - Icon ứng dụng: Kích thước chuẩn `192x192` và `512x512` định dạng PNG.
   - Nhúng vào `<head>` của `index.html`:
     ```html
     <link rel="manifest" href="/manifest.json" />
     <meta name="theme-color" content="#10b981" />
     ```

2. **File Service Worker nhận thông báo ngầm (`public/OneSignalSDKWorker.js`):**
   - File worker do OneSignal cung cấp để chạy ngầm trên thiết bị di động, lắng nghe sự kiện push từ server và kích hoạt notification pop-up.

3. **Mã khởi tạo SDK trong `index.html`:**
   - Nhúng script của OneSignal và khởi tạo với `appId` của dự án:
     ```html
     <script src="https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js" defer></script>
     <script>
       window.OneSignalDeferred = window.OneSignalDeferred || [];
       OneSignalDeferred.push(async function(OneSignal) {
         await OneSignal.init({
           appId: "<ONESIGNAL_APP_ID>",
           notifyButton: { enable: true },
         });
       });
     </script>
     ```

### 4.3 Quy Trình Người Dùng Cài Đặt Lên Điện Thoại
- **Trên Android (Google Chrome):**
  1. Truy cập `https://tmec.site`.
  2. Bấm vào biểu tượng dấu 3 chấm ở góc trên bên phải.
  3. Chọn **"Cài đặt ứng dụng"** (hoặc thanh banner "Thêm TMEC vào màn hình chính" tự động hiện lên).
  4. Bấm đồng ý nhận thông báo đẩy khi được hỏi.
- **Trên iPhone / iPad (iOS Safari):**
  1. Truy cập `https://tmec.site` bằng trình duyệt **Safari** (bắt buộc, không mở qua trình duyệt nhúng của Zalo/Facebook).
  2. Bấm vào nút **Chia sẻ** (biểu tượng hình vuông có mũi tên trỏ lên ở thanh công cụ dưới cùng).
  3. Chọn mục **"Thêm vào MH chính" (Add to Home Screen)**.
  4. Thoát ra màn hình chính, mở ứng dụng TMEC từ icon vừa tạo.
  5. Khi mở lần đầu từ màn hình chính, nhấn **"Cho phép nhận thông báo"** (iOS chỉ cấp quyền Web Push cho ứng dụng đã được thêm vào Màn hình chính).

### 4.4 Checklist Các Bước Triển Khai Tiếp Theo
- [x] Tạo ứng dụng `TMEC App` trên OneSignal Dashboard.
- [ ] Lấy mã `appId` từ OneSignal (dạng UUID).
- [ ] Tạo file `manifest.json` và xuất bộ icon `192x192`, `512x512` vào `Racehorse_Training_Management_System_MT_FE/public/`.
- [ ] Tải file `OneSignalSDKWorker.js` đặt vào thư mục `public/`.
- [ ] Thêm script OneSignal vào `index.html`.
- [ ] Deploy lên Vercel (`git push`) và test gửi thông báo thử nghiệm từ OneSignal Dashboard.

---

## 5. Đề Xuất Thiết Kế Lại Trải Nghiệm Người Dùng (UX/UI Redesign Proposal) Chuyên Sâu (Làm Sau)

> [!NOTE]
> **Trạng thái:** KẾ HOẠCH NÂNG CẤP TƯƠNG LAI (UPGRADE ROADMAP - LÀM SAU KHI DỰ ÁN ỔN ĐỊNH)
> **Mục tiêu:** Bổ sung phương án thiết kế lại toàn diện cho 2 phân hệ trọng yếu:
> 1. **Màn hình Task List của Groom (`DailyTasksPage.tsx` / Checklist chăm sóc hàng ngày).**
> 2. **Màn hình Quản lý Tài chính (`CostReportPage.tsx` / `OwnerFinancialReportsPage.tsx` / `ClubCashflowReportView.tsx`).**

### 5.1. Màn Hình Task List Của Groom (Field-Ready Mobile Care Checklist)

#### A. Phân tích hiện trạng & Nỗi đau người dùng (Pain Points):
- **Bối cảnh làm việc:** Groom thao tác trực tiếp tại khu chuồng trại (Barn A, B, C, H), tay đeo găng bảo hộ hoặc bám bụi bẩn, dùng smartphone bằng một tay ngoài trời (nắng gắt, độ chói cao).
- **Hạn chế giao diện hiện tại (`DailyTasksPage.tsx`):**
  - **Bố cục Table kiểu Desktop:** Dạng bảng kẻ dòng truyền thống, chữ nhỏ, trên điện thoại phải cuộn ngang liên tục.
  - **Liệt kê phẳng, thiếu phân tuyến:** Công việc hiển thị theo thứ tự thời gian tạo, không gom nhóm theo **Tuyến đi chuồng (Walk-through Order: Stall A-01 $\rightarrow$ A-12)** khiến Groom phải di chuyển lộn xộn giữa các dãy chuồng.
  - **Task y tế bị chìm lấp:** Y lệnh uống thuốc (`MEDICATION`) hay chườm đá hồi phục sau chạy (`ICE_BOOT_REST`) trông tương tự việc dọn phân hay cho ăn cỏ, dễ gây bỏ sót thuốc của ngựa.
  - **Thao tác hoàn thành rườm rà:** Nút bấm nhỏ, cần nhiều bước chạm hoặc popup modal không cần thiết.

#### B. Giải pháp thiết kế lại: Bố cục "Thẻ Ca Trực 1-Chạm" (Mobile-First Card Flow):
- **Cấu trúc ca trực thông minh (Shift-based Tabs):**
  - Tự động nhận diện giờ hiện tại để mở sẵn tab ca tương ứng:
    - *🌅 Ca Sáng (05:30 - 08:30):* Dọn phân sớm, nước sạch, ăn cỏ sáng, thuốc sáng.
    - *☀️ Ca Trưa (11:00 - 13:00):* Cám tăng lực, kiểm tra sức khỏe giữa ngày.
    - *🌇 Ca Chiều (16:00 - 18:30):* Tắm rửa, chải lông, chườm lạnh sau chạy, ăn tối.
- **Sắp xếp theo Tuyến đi tuần (Barn Walk-through Order):**
  - Tự động gom nhóm các task theo số chuồng `Stall A-01` $\rightarrow$ `A-02` $\rightarrow$ `A-03`... Groom đi cuốn chiếu dọc hành lang là dứt điểm công việc.
- **Hệ thống mã màu (Color-Coded Badges) & Nhận diện to rõ:**
  - 🔴 **Đỏ cam - Y tế (`MEDICATION`):** Icon viên thuốc, tên thuốc + liều lượng cỡ lớn, viền nhấp nháy nếu quá giờ y lệnh.
  - 🧊 **Xanh băng - Hồi phục (`ICE_BOOT_REST / THERAPY`):** Đếm ngược thời gian chườm đá (ví dụ: Chườm đủ 20 phút rồi tháo).
  - 🟢 **Xanh lá - Dinh dưỡng (`FEEDING`):** Hiển thị rõ loại thức ăn và định lượng (tránh cho nhầm cỏ của ngựa ăn kiêng).
  - ⚪ **Xám/Xanh nhạt - Vệ sinh chuồng (`CLEANING`):** Dọn phân, thay rơm đệm lót sạch.
- **Nút bấm 1-Chạm cỡ lớn (One-Tap Touch Target $\ge 48\text{px}$):**
  - Nút hoàn thành to bản toàn chiều rộng thẻ ở góc dưới, dễ bấm kể cả khi đeo găng tay.
  - Hỗ trợ thao tác quẹt phải (Swipe Right to Complete) với phản hồi rung (Haptic feedback) trên điện thoại.
- **Chụp ảnh bằng chứng (Proof-of-Care Camera):**
  - Nút icon máy ảnh nhanh để Groom chụp 1 giây tình trạng chuồng đã dọn sạch hoặc ngựa đã ăn hết cỏ gửi lên hệ thống cho Quản lý & HLV an tâm.

#### C. Wireframe giao diện Groom trên Mobile:
```text
+-----------------------------------------------------------+
| ☰  EquiFlow Groom         [🔔 2 Khẩn]   [👤 Groom Tuấn]   |
+-----------------------------------------------------------+
| 📅 Hôm nay: Thứ Tư, 22/11/2026                            |
| 📊 TIẾN ĐỘ CA SÁNG: [████████████░░░░] 12/16 Việc (75%)   |
| ⏱️ Còn 45 phút là hết ca sáng                            |
+-----------------------------------------------------------+
| [🌅 Ca Sáng (Đang chạy)] | [☀️ Ca Trưa] | [🌇 Ca Chiều]    |
+-----------------------------------------------------------+
| 📍 LỌC THEO DÃY CHUỒNG:  [Tất cả] [Dãy A ⭐] [Dãy B] [Dãy C] |
+-----------------------------------------------------------+
|                                                           |
| 🔴 [ƯU TIÊN CAO - Y TẾ VET]                ⏰ 06:30 AM    |
| 🐴 Stall A-02: Bão Táp (Thunderbolt)                       |
| 💊 Cho uống thuốc: Meloxicam 15ml (Giảm đau khớp gối)     |
| ⚠️ Ghi chú Vet: Trộn vào cháo cám sau khi ăn nhẹ.         |
| --------------------------------------------------------- |
| [ 📷 Chụp ảnh thuốc ]           [ ✅ XÁC NHẬN ĐÃ UỐNG ]   |
|                                (Nút to màu đỏ - 52px)     |
+-----------------------------------------------------------+
|                                                           |
| 🟢 [KHẨU PHẦN ĐẶC BIỆT]                    ⏰ 07:00 AM    |
| 🐴 Stall A-03: Xích Thố                                   |
| 🌾 Cho ăn: 3kg Cỏ Alfalfa + 2 muỗng Bột điện giải         |
| --------------------------------------------------------- |
|                                 [ ✅ HOÀN THÀNH (1 Chạm) ]|
+-----------------------------------------------------------+
|                                                           |
| ⚪ [DỌN VỆ SINH CHUỒNG]                    ⏰ 07:30 AM    |
| 🐴 Stall A-01: Bạch Long                                  |
| 🧹 Dọn phân, thay rơm đệm lót sạch Dãy A01                |
| --------------------------------------------------------- |
|                                 [ ✅ HOÀN THÀNH ]         |
+-----------------------------------------------------------+
```

---

### 5.2. Màn Hình Quản Lý Tài Chính & Báo Cáo Minh Bạch (Financial Hub)

Phân tách độc lập 2 góc nhìn người dùng:
1. **Quản lý CLB (`CLUB_MANAGER`):** Quản lý dòng tiền vận hành, thu hộ, chi phí kho và lợi nhuận ròng.
2. **Chủ ngựa (`HORSE_OWNER`):** Minh bạch từng dòng chi phí, công thức cấn trừ tiền thưởng và thanh toán 1-chạm VietQR.

#### A. Phía Quản lý CLB (`Club Cashflow Dashboard`):
- **4 Thẻ Chỉ số Dòng tiền Rõ Ràng (Cashflow KPI Cards):**
  1. 🟢 **Tổng Thực thu dịch vụ (Cash In):** Phí chuồng, huấn luyện, thú y.
  2. 🔴 **Tổng Chi phí vận hành (Cash Out):** Nhập kho thức ăn, thuốc thú y, bảo trì chuồng trại.
  3. 🏆 **Quỹ thưởng giải đua giữ hộ (Prize Pool):** Tách bạch rõ tỷ lệ 85% chủ ngựa - 15% CLB.
  4. 💎 **Dòng tiền ròng thực tế (Net Operating Cashflow):** Thực thu - Thực chi.
- **Cảnh báo công nợ tự động (Smart Debt Alerts):** Phân loại hóa đơn Chờ thanh toán, Đã thanh toán, Quá hạn 🚨 kèm nút 1-click gửi nhắc nhở SMS/Email.
- **Cơ chế "CLB Cần Hoàn Tiền" (Refund Indicator):** Hiển thị rõ các trường hợp ngựa thắng giải lớn có tiền thưởng (85%) cao hơn tổng chi phí nuôi tháng, hệ thống hỗ trợ lập lệnh hoàn tiền minh bạch.

**Wireframe Desktop Quản lý CLB:**
```text
+----------------------------------------------------------------------------------------------------+
| 🏦 TỔNG QUAN TÀI CHÍNH CLB                            [📅 Tháng 11/2026 ▼]  [📥 Xuất Báo Cáo Excel] |
+----------------------------------------------------------------------------------------------------+
| [🟢 TỔNG THỰC THU DỊCH VỤ] | [🔴 TỔNG CHI PHÍ VẬN HÀNH] | [🏆 QUỸ THƯỞNG GIẢI ĐUA] | [💎 DÒNG TIỀN RÒNG]   |
|      184.500.000 đ         |       92.300.000 đ         |       150.000.000 đ      |    +92.200.000 đ      |
|  (Phí chuồng + Thú y + HL)  |  (Vật tư cỏ, thuốc, bảo trì)|  (85% Chủ: 127.5tr | 15%)|  (Thực tế giữ lại)    |
|  ↗ +12% so với tháng trước |  ↘ Giảm 4% hao hụt kho     |  Đã giải ngân: 100%      |  Biên LN: 49.9%       |
+----------------------------------------------------------------------------------------------------+
|                                                                                                    |
| 📑 BẢNG THEO DÕI HÓA ĐƠN & THU HỘ CHỦ NGỰA                                                         |
| Lọc: [Tất cả] [Chờ thanh toán (3)] [Quá hạn 🚨 (1)] [Đã thanh toán (18)]   [🔍 Tìm chủ/ngựa...]    |
+----------------------------------------------------------------------------------------------------+
| Mã Hóa Đơn  | Chủ Ngựa       | Ngựa Phụ Trách | Phí Lưu Trú & DV | Cấn Trừ Giải | CÒN PHẢI THU | Tình Trạng   | Thao Tác      |
|-------------+----------------+----------------+------------------+--------------+--------------+--------------+---------------|
| INV-2026-11 | Nguyễn Văn A   | Xích Thố       |  12.500.000 đ    | -8.500.000 đ | 4.000.000 đ  | ⏳ Chờ thu   | [🔔 Nhắc nợ]  |
| INV-2026-10 | Trần Thị B     | Bão Táp        |  14.200.000 đ    | -17.000.000 đ| -2.800.000 đ | 🔄 CLB Hoàn  | [💸 Hoàn tiền]|
| INV-2026-09 | Lê Hoàng C     | Hắc Mã         |  10.000.000 đ    | 0 đ          | 10.000.000 đ | 🚨 Quá 5 ngày| [📞 Gọi điện] |
+----------------------------------------------------------------------------------------------------+
```

#### B. Phía Chủ ngựa (`Owner Billing & Prize Portal`):
- **Công thức cấn trừ trực quan dạng sơ đồ (No More Confusion):**
  $$\text{Số tiền thực trả} = \text{Chi phí chăm sóc (Phí chuồng + Thú y + Giáo án)} - \text{85\% Tiền thưởng giải đua}$$
  - Nếu kết quả âm: CLB đang giải ngân hoàn trả tiền thưởng cho chủ ngựa.
  - Nếu kết quả dương: Hiển thị hạn nộp kèm nút quét mã VietQR.
- **Thanh toán tức thì bằng VietQR chuẩn Napas (1-Scan Payment):**
  - Tự động sinh mã VietQR với đúng tài khoản CLB, số tiền chính xác và nội dung chuyển khoản chuẩn hóa (VD: `THANH TOAN INV202611 XICHTHO`), thanh toán chỉ trong 3 giây.
- **Minh chứng chi tiết đính kèm (Receipt Proof):**
  - Từng khoản mục khám bệnh, thuốc men thú y có nút đính kèm ảnh đơn thuốc hoặc biên lai vật tư để chủ ngựa kiểm tra minh bạch.
- **Hỗ trợ chuyển đổi đa chiến mã (Multi-Horse Switcher):**
  - Chủ ngựa có nhiều ngựa có thể lọc theo từng con hoặc xem tổng thể cả đàn ngựa của mình.

**Wireframe Cổng Tài chính Chủ ngựa:**
```text
+-------------------------------------------------------------------------+
| 🐴 CHI PHÍ & THU NHẬP CHIẾN MÃ: [ XÍCH THỐ ⭐ ]      [Tháng 11/2026 ▼]  |
+-------------------------------------------------------------------------+
|                                                                         |
|  📊 BẢNG CÂN ĐỐI TÀI CHÍNH THÁNG 11:                                    |
|                                                                         |
|    ➕ TỔNG CHI PHÍ THÁNG (Phí nuôi + Thú y):          12.500.000 đ       |
|    ➖ THU NHẬP GIẢI THƯỞNG ĐƯỢC CHIA (85%):          - 8.500.000 đ       |
|    ------------------------------------------------------------------   |
|    💰 SỐ TIỀN THỰC CẦN THANH TOÁN:                    4.000.000 đ       |
|       (Hạn thanh toán: 30/11/2026 - Còn 8 ngày)                         |
|                                                                         |
+-------------------------------------------------------------------------+
|                                                                         |
|    [ 📱 QUÉT MÃ VIETQR THANH TOÁN NGAY (4.000.000 đ) ]                 |
|    (Nhấn để hiện mã QR chuẩn Napas - Chuyển khoản 3 giây tự gạch nợ)   |
|                                                                         |
+-------------------------------------------------------------------------+
| 🔍 CHI TIẾT CÁC KHOẢN MỤC (Minh bạch 100%):                             |
|                                                                         |
| 1. [Phí lưu trú & chăm sóc cơ bản]                         8.000.000 đ  |
|    • Bao gồm: Chuồng Dãy A-03, Cỏ & Cám chuẩn 30 ngày.                  |
|                                                                         |
| 2. [Y tế & Trị liệu Thú y]                                 2.500.000 đ  |
|    • 14/11: Khám định kỳ & Tiêm Vitamin cơ: 800.000 đ      [📄 Đơn thuốc]|
|    • 18/11: Chườm lạnh & Băng bó phục hồi: 1.700.000 đ     [📷 Chứng từ] |
|                                                                         |
| 3. [Giáo án Huấn luyện Chuyên sâu]                         2.000.000 đ  |
|    • HLV Hùng: 12 buổi chạy nước rút sa trường.                         |
|                                                                         |
| 4. [Thu nhập: Tiền thưởng Giải Mùa Thu] (Cộng vào)       - 8.500.000 đ  |
|    • Tổng giải Nhì: 10.000.000 đ (Chủ ngựa nhận 85%, CLB 15%)           |
+-------------------------------------------------------------------------+
| [📄 Tải Hóa Đơn PDF (Bản A4)]             [💬 Chat Hỏi Kế Toán CLB]     |
+-------------------------------------------------------------------------+
```

---

### 5.3. Bảng Đối Chiếu Giá Trị Mang Lại Cho Vận Hành

| Tiêu chí | Giao diện hiện tại | Giao diện đề xuất mới |
| :--- | :--- | :--- |
| **Groom - Thiết bị sử dụng** | Bảng Table desktop, chữ bé, khó xem trên điện thoại | Thiết kế Mobile-First dạng thẻ (Cards), tối ưu màn hình cảm ứng |
| **Groom - Trình tự công việc** | Danh sách lộn xộn theo ngày | Gom theo **Ca trực** & **Tuyến đi chuồng A01 $\rightarrow$ A12** |
| **Groom - Nhiệm vụ Y tế/Thuốc** | Trông giống hệt dọn chuồng | Badge đỏ cam nổi bật, cảnh báo liều lượng và giờ uống của Vet |
| **Groom - Thao tác hoàn thành** | Phải click nhiều lần hoặc mở modal | **1-Chạm to bản** ($\ge 48\text{px}$) hoặc Quẹt phải tiện lợi |
| **Tài chính - Quản lý CLB** | Phân mảnh giữa chi phí và hóa đơn | Dashboard 4 chỉ số dòng tiền: Thu, Chi, Quỹ giải đua, Lãi ròng |
| **Tài chính - Chủ ngựa** | Chỉ thấy tổng tiền, khó hiểu tại sao âm/dương | Sơ đồ cấn trừ trực quan: **Chi phí - 85% Thưởng = Thực thanh toán** |
| **Tài chính - Thanh toán** | Nhập tay tài khoản ngân hàng thủ công | **Mã VietQR động tự sinh** quét là xong trong 3 giây |



