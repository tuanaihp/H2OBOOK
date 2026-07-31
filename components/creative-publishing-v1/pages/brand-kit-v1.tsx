"use client";

import { ChangeEvent, useMemo, useState } from "react";
import { Copy, Palette, Plus, Save, Trash2, Upload } from "lucide-react";
import { useAppStore } from "@/store/app-store";
import { emitCreativeEvent } from "@/lib/creative-publishing-v1/events";
import { CreativePageFrame, StatusPill, SurfaceCard, styles } from "../creative-shared";
import type { BrandProfile } from "@/types/editor";

const blankBrand: Omit<BrandProfile, "id"> = {
  name: "Thương hiệu mới",
  expertName: "",
  expertTitle: "",
  logoUrl: "",
  avatarUrl: "",
  primaryColor: "#6f1446",
  secondaryColor: "#f6e9ee",
  accentColor: "#d4a055",
  headingFont: "Georgia",
  bodyFont: "Arial",
  phone: "",
  email: "",
  website: "",
  address: "",
  introduction: "",
  copyrightText: "",
};

export function BrandKitV1() {
  const store = useAppStore();
  const active = store.brands.find((brand) => brand.id === store.activeBrandId) ?? store.brands[0] ?? { id: "preview_brand", ...blankBrand };
  const [draft, setDraft] = useState<BrandProfile>(active);
  const smartFields = useMemo(() => [
    ["{{brand.name}}", draft.name],
    ["{{brand.logo}}", draft.logoUrl || "asset://brand-logo"],
    ["{{brand.primary_color}}", draft.primaryColor],
    ["{{expert.name}}", draft.expertName],
    ["{{expert.title}}", draft.expertTitle],
    ["{{brand.website}}", draft.website],
  ], [draft]);

  const chooseBrand = (brand: BrandProfile) => {
    store.setActiveBrand(brand.id);
    setDraft(brand);
  };

  const update = <K extends keyof BrandProfile>(key: K, value: BrandProfile[K]) => setDraft((current) => ({ ...current, [key]: value }));

  const save = () => {
    store.updateBrand(draft.id, draft);
    emitCreativeEvent({ name: "creative_action_clicked", surface: "brand-kit", action: "save_brand", entityId: draft.id });
  };

  const createBrand = () => {
    const created = store.createBrand(blankBrand);
    chooseBrand(created);
  };

  const importImage = (field: "logoUrl" | "avatarUrl") => (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    update(field, url);
  };

  const copyJson = async () => {
    await navigator.clipboard.writeText(JSON.stringify(draft, null, 2));
  };

  return <CreativePageFrame active="brand-kit" eyebrow="BRAND AUTOMATION" title="Brand Kit" description="Một nguồn nhận diện duy nhất cho sách, thiết kế, template, clone và public reader." actions={<><button className={styles.secondaryButton} onClick={createBrand}><Plus/>Brand mới</button><button className={styles.primaryButton} onClick={save}><Save/>Lưu Brand Kit</button></>} metrics={[
    { label: "Brand Profile", value: store.brands.length },
    { label: "Smart Fields", value: smartFields.length },
    { label: "Sách dùng Brand", value: store.books.filter((book) => book.brandId === draft.id).length },
    { label: "Clone", value: store.clones.filter((clone) => clone.brandId === draft.id).length },
  ]}>
    <div className={styles.twoColumnNarrow}>
      <SurfaceCard title="Brand Profiles" description="Chọn thương hiệu đang chỉnh sửa.">
        <div className={styles.brandList}>{store.brands.map((brand) => <button key={brand.id} className={brand.id === draft.id ? styles.brandActive : styles.brandItem} onClick={() => chooseBrand(brand)}><span style={{ background: brand.primaryColor }}>{brand.name.slice(0, 2).toUpperCase()}</span><div><strong>{brand.name}</strong><small>{brand.expertName}</small></div>{brand.id === draft.id ? <StatusPill tone="success">Đang dùng</StatusPill> : null}</button>)}</div>
        <button className={styles.dangerButton} disabled={store.brands.length <= 1} onClick={() => { store.deleteBrand(draft.id); const next = store.brands.find((item) => item.id !== draft.id); if (next) chooseBrand(next); }}><Trash2/>Xóa Brand Profile</button>
      </SurfaceCard>
      <SurfaceCard title="Nhận diện thương hiệu" description="Dữ liệu được dùng cho Smart Fields và Auto Clone." icon={<Palette/>}>
        <div className={styles.formGrid}>
          <label><span>Tên thương hiệu</span><input value={draft.name} onChange={(event) => update("name", event.target.value)}/></label>
          <label><span>Tên chuyên gia</span><input value={draft.expertName} onChange={(event) => update("expertName", event.target.value)}/></label>
          <label><span>Chức danh</span><input value={draft.expertTitle} onChange={(event) => update("expertTitle", event.target.value)}/></label>
          <label><span>Website</span><input value={draft.website} onChange={(event) => update("website", event.target.value)}/></label>
          <label><span>Điện thoại</span><input value={draft.phone} onChange={(event) => update("phone", event.target.value)}/></label>
          <label><span>Email</span><input value={draft.email} onChange={(event) => update("email", event.target.value)}/></label>
          <label className={styles.fullField}><span>Địa chỉ</span><input value={draft.address} onChange={(event) => update("address", event.target.value)}/></label>
          <label className={styles.fullField}><span>Giới thiệu chuyên gia</span><textarea value={draft.introduction ?? ""} onChange={(event) => update("introduction", event.target.value)}/></label>
        </div>
        <div className={styles.colorGrid}>{(["primaryColor", "secondaryColor", "accentColor"] as const).map((key) => <label key={key}><span>{key}</span><input type="color" value={draft[key]} onChange={(event) => update(key, event.target.value)}/><code>{draft[key]}</code></label>)}</div>
        <div className={styles.formGrid}><label><span>Font tiêu đề</span><input value={draft.headingFont} onChange={(event) => update("headingFont", event.target.value)}/></label><label><span>Font nội dung</span><input value={draft.bodyFont} onChange={(event) => update("bodyFont", event.target.value)}/></label><label className={styles.fullField}><span>Bản quyền chân trang</span><input value={draft.copyrightText ?? ""} onChange={(event) => update("copyrightText", event.target.value)}/></label></div>
        <div className={styles.uploadGrid}><label><Upload/>Tải logo<input hidden type="file" accept="image/*" onChange={importImage("logoUrl")}/></label><label><Upload/>Tải ảnh chuyên gia<input hidden type="file" accept="image/*" onChange={importImage("avatarUrl")}/></label></div>
      </SurfaceCard>
    </div>
    <div className={styles.threeColumn}>
      <article className={styles.brandPreview} style={{ background: `linear-gradient(135deg, ${draft.primaryColor}, ${draft.accentColor})` }}><small>{draft.name}</small><h2>Giáo trình Makeup Chuyên Nghiệp</h2><p>{draft.expertName} — {draft.expertTitle}</p><span>{draft.website} · {draft.phone}</span></article>
      <SurfaceCard title="Smart Fields"><div className={styles.smartFields}>{smartFields.map(([key, value]) => <div key={key}><code>{key}</code><span>{value || "—"}</span></div>)}</div></SurfaceCard>
      <SurfaceCard title="Brand JSON"><button className={styles.secondaryButton} onClick={() => void copyJson()}><Copy/>Sao chép Brand JSON</button></SurfaceCard>
    </div>
  </CreativePageFrame>;
}
