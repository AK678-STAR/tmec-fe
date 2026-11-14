# Mô phỏng trong web chính

Web FE tự chạy engine Canvas; không cần mở hay khởi động ứng dụng Simulator ở cổng 5175.
Backend và PostgreSQL vẫn cần hoạt động như các nghiệp vụ khác.

| Vai trò | Điểm vào | Bố cục |
| --- | --- | --- |
| Veterinarian | Biểu mẫu bệnh án: mở khám hoặc lấy chỉ số nhanh | Drawer bên phải |
| Head Trainer | Chi tiết kết quả buổi tập: xem mô phỏng hoặc lấy nhanh | Thẻ nhúng |
| Club Manager | Giải đua và biểu mẫu kết quả: mở mô phỏng | Modal toàn cảnh |

Owner/Groom không được mở mô phỏng. API tạo phiên và backend tiếp tục kiểm tra quyền/nghiệp vụ.
Kết quả mô phỏng được gửi bằng gói Socket.IO hiện có; chỉ sau ACK thành công FE mới tải
bản nháp. Bác sĩ/HLV/quản lý vẫn kiểm tra rồi lưu/chốt bằng biểu mẫu cũ.
Phân bổ thưởng, khóa kết quả và khóa y tế giữ theo nghiệp vụ hiện tại.

## Cài đặt và kết nối

Chạy `npm install` trong FE để cài `socket.io-client` đã được ghi trong lockfile.
`VITE_API_URL` trỏ tới API hiện có, ví dụ `http://localhost:3000/api`.
Socket mặc định suy ra từ API, ví dụ `http://localhost:3000/simulator`.
Chỉ đặt `VITE_SOCKET_URL` khi dùng máy chủ Socket.IO khác.

Không truy cập `launchUrl` trả về từ backend. FE sử dụng `sessionId` để lấy context
và xác thực socket. Với giải đua, FE lấy hồ sơ từng ngựa qua API hồ sơ hiện có vì
context giải đua chưa chứa cờ khóa y tế.

Chạy nhanh và xem trực tiếp dùng cùng engine và gói kết quả. Bản nhúng dùng nguyên
`TrialTab`, `RaceTab`, hoạt ảnh khám của `VetZone`, HUD tám chỉ số, biểu đồ, renderer,
CSS pixel và sprite của Simulator gốc. Tốc độ giữ 1×/10×/60×/tạm dừng.
Sau khi ngựa tập về đích, hồi phục chạy tối thiểu 10× để ghi nhận đủ mười phút HR
mà không vượt giới hạn phiên năm phút của gateway; vẫn có nút bỏ qua hồi phục gốc.
Lượt chạy đã gửi kết quả không được khởi động lại trên cùng session.
Biểu mẫu kết quả tập bị khóa chỉnh sửa trong lúc chạy để tránh mất dữ liệu khi nạp kết quả.

Nút gãy xương/khập khiễng ở chạy thử và chọn làn gây gãy chân ở giải đua gửi
`sim:incident_report` qua transport hiện có. Mỗi ngựa chỉ nhận một sự cố trong lượt
đang chạy, khớp giới hạn của engine. Không tự bật khóa y tế; bác sĩ vẫn quyết định.
Vet chỉ có phần khám, hoạt ảnh lâm sàng và cảnh báo của ngựa được chọn; không có
bản đồ trang trại hay điều hướng đàn ngựa.

## Kiểm tra

- `npm run test:unit` — Node 24: engine, packet identity, vai trò, context, medical lock và retry/ACK.
- `npm run test:simulation` — Playwright với HTTP/Socket.IO fixture cục bộ ở 4182/4302,
  không ghi cơ sở dữ liệu. Cần dependencies của BE đã được cài để fixture dùng Socket.IO server.
  Ca đối chiếu hình ảnh đọc component từ repo Simulator cạnh FE, so canvas cùng dữ liệu
  và kích thước bằng SHA-256 của pixel PNG. Test-only Vite config cho phép đọc nguồn đó;
  production không import code từ repo Simulator.
- `npm run lint`, `npm run typecheck`, `npm run build` — các gate FE hiện tại.

Fixture trình duyệt kiểm tra giao thức thật và caller huấn luyện, nhưng không thay thế
kiểm thử lưu vào PostgreSQL thật. Để nghiệm thu dữ liệu, chạy backend, đăng nhập từng
vai trò, chạy mô phỏng rồi kiểm tra bản nháp và xác nhận chính thức bằng biểu mẫu.

## Nguồn mã

`src/features/simulation/engine/` và `native/{ui,render}/` được chép từ
`Racehorse_Simulator_Web` trong workspace ngày 2026-11-14. Bản nhúng bỏ Farm Hub,
catalogue ngựa mẫu và renderer chuồng trại; giữ nguyên renderer đường chạy, ngựa,
thời tiết, khán giả, cổng xuất phát, bảng xếp hạng và hiệu ứng về đích/sự cố.
Các thay đổi thích nghi gồm callback phiên/ACK, bản dịch vi/en, khóa cấu hình chỉ định,
URL tài nguyên và thao tác trở về bệnh án. Token pixel được cô lập trong
`[data-native-simulator]`; theme của web chính bỏ qua vùng này.
`public/simulation/sprites/` chứa bốn sheet gốc: horse, rider, fx, people.
Ba font gốc VT323/Handjet/Silkscreen được lưu cục bộ trong `public/simulation/fonts/`,
lấy từ URL Google Fonts có sẵn trong `Racehorse_Simulator_Web/index.html`.
Engine vẫn thuần TypeScript. API context đi qua HTTP client của FE; URL socket suy ra từ môi trường FE.
Các test engine và transport được chép cùng để giữ bằng chứng tương thích.
Các thay đổi sau này ở Simulator cần được đối chiếu thủ công với bản chép này.
