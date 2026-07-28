import type { DesignFormatKey, DesignFormatPreset } from "@/types/design-library";

export const DESIGN_FORMATS: Record<DesignFormatKey, DesignFormatPreset> = {
  "facebook-cover": {
    key: "facebook-cover",
    label: "Cover Fanpage",
    width: 1640,
    height: 624,
    purpose: "Ảnh bìa Facebook/Fanpage chất lượng cao",
    safeArea: 72
  },
  "portrait-post": {
    key: "portrait-post",
    label: "Bài đăng dọc 4:5",
    width: 1080,
    height: 1350,
    purpose: "Facebook/Instagram post ưu tiên màn hình điện thoại",
    safeArea: 64
  },
  "square-post": {
    key: "square-post",
    label: "Bài đăng vuông",
    width: 1080,
    height: 1080,
    purpose: "Bài đăng vuông đa nền tảng",
    safeArea: 60
  },
  story: {
    key: "story",
    label: "Story/Reel cover",
    width: 1080,
    height: 1920,
    purpose: "Story, Reel cover và nội dung dọc toàn màn hình",
    safeArea: 92
  },
  "a5-invitation": {
    key: "a5-invitation",
    label: "Thiệp A5 dọc",
    width: 794,
    height: 1123,
    purpose: "Thiệp kỹ thuật số hoặc in A5",
    safeArea: 48
  },
  "a4-certificate-landscape": {
    key: "a4-certificate-landscape",
    label: "Bằng A4 ngang",
    width: 1123,
    height: 794,
    purpose: "Bằng tốt nghiệp/chứng nhận A4 ngang",
    safeArea: 54
  }
};

export const formatLabel = (key: DesignFormatKey) => DESIGN_FORMATS[key].label;
