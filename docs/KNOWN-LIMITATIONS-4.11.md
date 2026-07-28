# Giới hạn đã biết — H2OBOOK Professional 4.11

Tài liệu này ngăn việc hiểu nhầm giữa “đã có foundation” và “đã hoàn thiện như sản phẩm chuyên ngành lâu năm”.

1. **Full build chưa được chạy trong môi trường đóng gói** do thiếu dependency registry.
2. **Một số UI cũ vẫn dùng Zustand/local data.** Generic CRUD APIs đã có nhưng việc chuyển từng màn hình cần test theo module.
3. **Compose Mode là rich-text foundation dựa trên contentEditable.** Chưa đạt độ sâu của ProseMirror/Tiptap với full track changes, table và collaborative cursor.
4. **Text flow/master page nâng cao** mới có model và preflight foundation, chưa phải desktop-publishing compositor hoàn chỉnh.
5. **EPUB binary assets** chưa được đóng gói đầy đủ cho mọi asset R2 trong local exporter; cần asset resolver/download pipeline.
6. **PDF/X** cần ICC profile thật và validation bên ngoài; không thể tuyên bố chuẩn chỉ dựa trên Ghostscript flag.
7. **SCORM/xAPI** là package foundation; phải kiểm tra bằng SCORM Cloud/LRS thực tế.
8. **LTI 1.3** mới có database standard placeholder, chưa có OIDC login/deep-link/grade-service handshake.
9. **Real-time collaboration Pro** chưa dùng Yjs/Hocuspocus; presence, page lock, review và remix đã có.
10. **Analytics rollup** chưa có worker tổng hợp quy mô lớn; report hiện đọc event window giới hạn.
11. **Growth protected embed** được áp dụng qua `/embed/[slug]`; direct Reader vẫn phụ thuộc publication/entitlement policies riêng.
12. **SSO** mới có configuration schema; SAML/OIDC handshake phải làm theo provider được chọn.
13. **Marketplace payment/payout** chưa gắn cứng với một payment provider hoặc ngân hàng.
14. **Public API** hiện mới có endpoint đọc sách mẫu; các endpoint khác cần scope và contract riêng.
15. **Webhook endpoints cũ** không có encrypted secret và phải rotate sau migration `0018`.

Các giới hạn trên không làm core phụ thuộc AI. AI vẫn là lớp hoàn toàn tùy chọn.
