import { BadgeCheck, ShieldAlert } from "lucide-react";
import type { CertificateIssue } from "@/types/operations";
import styles from "./operations.module.css";

export function CertificateVerification({ certificateNo, certificate }: { certificateNo: string; certificate?: CertificateIssue }) {
  const valid = certificate?.status === "valid";
  return <main className={styles.verifyPage}><section className={styles.verifyCard}><span className={styles.verifyMark}>{valid?<BadgeCheck size={31}/>:<ShieldAlert size={31}/>}</span><span className={styles.eyebrow}>H2OBOOK CERTIFICATE VERIFICATION</span><h1>{valid?"Chứng nhận hợp lệ":"Không tìm thấy chứng nhận hợp lệ"}</h1><p>{valid?"Thông tin dưới đây được xác minh từ hệ thống H2OBOOK.":`Mã ${certificateNo} không tồn tại hoặc đã bị thu hồi.`}</p>{certificate&&<div className={styles.verifyGrid}><div className={styles.verifyField}><span>Học viên</span><strong>{certificate.studentName}</strong></div><div className={styles.verifyField}><span>Khóa học</span><strong>{certificate.courseName}</strong></div><div className={styles.verifyField}><span>Mã bằng</span><strong>{certificate.certificateNo}</strong></div><div className={styles.verifyField}><span>Ngày cấp</span><strong>{new Date(certificate.issuedAt).toLocaleDateString("vi-VN")}</strong></div><div className={styles.verifyField}><span>Giảng viên</span><strong>{certificate.instructorName}</strong></div><div className={styles.verifyField}><span>Trạng thái</span><strong>{certificate.status}</strong></div></div>}</section></main>;
}
