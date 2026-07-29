import { DesignLibraryClient } from "@/components/design-library/design-library-client";

export const metadata = {
  title: "Thiết kế của tôi | H2OBOOK Student",
  description: "Học viên tự tạo cover, profile, thiệp và bằng riêng từ mẫu có sẵn, lưu vào tài khoản cá nhân."
};

export default function StudentDesignLibraryPage() {
  return <DesignLibraryClient variant="student"/>;
}
