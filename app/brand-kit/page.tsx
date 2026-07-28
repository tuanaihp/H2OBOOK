"use client";

import { useMemo, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Modal } from "@/components/ui/modal";
import { useAppStore } from "@/store/app-store";
import { Check, Copy, Palette, Plus, Save, Trash2, Upload } from "lucide-react";
import type { BrandProfile } from "@/types/editor";
import { uploadAsset } from "@/lib/assets/asset-client";

export default function BrandKitPage() {
  const store = useAppStore();
  const [activeId, setActiveId] = useState(store.activeBrandId || store.brands[0]?.id);
  const original = useMemo(() => store.brands.find((item) => item.id === activeId) ?? store.brands[0], [store.brands, activeId]);
  const [draft, setDraft] = useState<BrandProfile>(() => structuredClone(original));
  const [saved, setSaved] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const switchBrand = (id: string) => { const brand = store.brands.find((item) => item.id === id); if (brand) { setActiveId(id); setDraft(structuredClone(brand)); store.setActiveBrand(id); } };
  const patch = <K extends keyof BrandProfile>(key: K, value: BrandProfile[K]) => setDraft((valueDraft) => ({ ...valueDraft, [key]: value }));
  const save = () => { store.updateBrand(draft.id, draft); setSaved(true); setTimeout(() => setSaved(false), 1500); };
  const create = () => { const brand = store.createBrand({ name: newName.trim() || "Thương hiệu mới" }); setCreateOpen(false); setNewName(""); switchBrand(brand.id); };
  if (!draft) return null;
  return <AppShell>
    <div className="page-header"><div><span className="eyebrow">BRAND AUTOMATION</span><h1>Brand Kit</h1><p>Tự động áp dụng logo, màu, font và thông tin chuyên gia lên toàn bộ sách.</p></div><div className="header-actions"><button className="btn btn-secondary" onClick={() => setCreateOpen(true)}><Plus size={16}/>Brand mới</button><button className="btn btn-primary" onClick={save}>{saved ? <Check size={16}/> : <Save size={16}/>} {saved ? "Đã lưu" : "Lưu Brand Kit"}</button></div></div>
    <div className="brand-layout-v2"><aside className="brand-list-card"><header><strong>Brand Profiles</strong><span>{store.brands.length} thương hiệu</span></header>{store.brands.map((brand) => <button key={brand.id} className={brand.id === activeId ? "active" : ""} onClick={() => switchBrand(brand.id)}><span className="brand-list-logo" style={{ background: brand.primaryColor }}>{brand.logoUrl ? <img src={brand.logoUrl} alt=""/> : brand.name.slice(0, 2)}</span><span><strong>{brand.name}</strong><small>{brand.expertName}</small></span>{brand.id === store.activeBrandId && <Check size={14}/>}</button>)}<button className="brand-add-button" onClick={() => setCreateOpen(true)}><Plus size={15}/>Thêm thương hiệu</button></aside>
      <section className="section-card"><div className="section-head"><div><h2>Nhận diện thương hiệu</h2><p>Dữ liệu được sử dụng cho Smart Fields và Auto Clone.</p></div><Palette size={20}/></div><div className="section-body form-grid">
        <label className="field"><span>Tên thương hiệu</span><input className="input" value={draft.name} onChange={(event) => patch("name", event.target.value)}/></label>
        <label className="field"><span>Tên chuyên gia</span><input className="input" value={draft.expertName} onChange={(event) => patch("expertName", event.target.value)}/></label>
        <label className="field"><span>Chức danh</span><input className="input" value={draft.expertTitle} onChange={(event) => patch("expertTitle", event.target.value)}/></label>
        <label className="field"><span>Website</span><input className="input" value={draft.website} onChange={(event) => patch("website", event.target.value)}/></label>
        <label className="field"><span>Điện thoại</span><input className="input" value={draft.phone} onChange={(event) => patch("phone", event.target.value)}/></label>
        <label className="field"><span>Email</span><input className="input" value={draft.email} onChange={(event) => patch("email", event.target.value)}/></label>
        <label className="field full"><span>Địa chỉ</span><input className="input" value={draft.address} onChange={(event) => patch("address", event.target.value)}/></label>
        <label className="field full"><span>Giới thiệu chuyên gia</span><textarea className="textarea" value={draft.introduction ?? ""} onChange={(event) => patch("introduction", event.target.value)}/></label>
        <div className="field full"><span>Bảng màu</span><div className="color-row">{([ ["primaryColor", "Màu chính"], ["secondaryColor", "Màu phụ"], ["accentColor", "Màu nhấn"] ] as const).map(([key, label]) => <label className="color-field" key={key}><input type="color" value={draft[key]} onChange={(event) => patch(key, event.target.value)}/><span><small>{label}</small><strong>{draft[key]}</strong></span></label>)}</div></div>
        <label className="field"><span>Font tiêu đề</span><select className="select" value={draft.headingFont} onChange={(event) => patch("headingFont", event.target.value)}><option>Georgia</option><option>Arial</option><option>Times New Roman</option><option>Verdana</option><option>Trebuchet MS</option></select></label>
        <label className="field"><span>Font nội dung</span><select className="select" value={draft.bodyFont} onChange={(event) => patch("bodyFont", event.target.value)}><option>Arial</option><option>Georgia</option><option>Times New Roman</option><option>Verdana</option><option>Tahoma</option></select></label>
        <label className="field full"><span>Bản quyền chân trang</span><input className="input" value={draft.copyrightText ?? ""} onChange={(event) => patch("copyrightText", event.target.value)} placeholder={`© ${new Date().getFullYear()} ${draft.name}`}/></label>
        <div className="field"><span>Logo chính</span><label className="upload-zone"><Upload size={22}/><strong>Tải logo</strong><small>PNG nền trong suốt</small><input type="file" accept="image/*" onChange={(event) => loadBrandImage(event, (assetId, previewUrl) => setDraft((value) => ({ ...value, logoAssetId: assetId, logoUrl: previewUrl })))}/></label></div>
        <div className="field"><span>Ảnh chuyên gia</span><label className="upload-zone"><Upload size={22}/><strong>Tải chân dung</strong><small>Ảnh vuông hoặc dọc</small><input type="file" accept="image/*" onChange={(event) => loadBrandImage(event, (assetId, previewUrl) => setDraft((value) => ({ ...value, avatarAssetId: assetId, avatarUrl: previewUrl })))}/></label></div>
      </div></section>
      <aside className="brand-preview-stack"><div className="preview-card brand-cover-preview" style={{ background: `linear-gradient(135deg,${draft.primaryColor},${draft.primaryColor}dd,${draft.accentColor})` }}>{draft.logoUrl ? <img className="preview-logo" src={draft.logoUrl} alt="Logo"/> : <small>{draft.name}</small>}<h3>Giáo trình Makeup Chuyên Nghiệp</h3><div><p>{draft.expertName} — {draft.expertTitle}</p><p className="preview-contact">{draft.website} • {draft.phone}</p></div></div><div className="smart-preview-card"><strong>Smart Fields</strong>{["brand.name", "brand.logo", "brand.primary_color", "expert.name", "expert.title", "brand.website"].map((field) => <code key={field}>{`{{${field}}}`}</code>)}</div><button className="btn btn-secondary" onClick={() => { navigator.clipboard?.writeText(JSON.stringify(draft, null, 2)); }}><Copy size={15}/>Sao chép Brand JSON</button>{store.brands.length > 1 && <button className="btn btn-danger" onClick={() => { store.deleteBrand(draft.id); switchBrand(store.brands.find((item) => item.id !== draft.id)?.id ?? ""); }}><Trash2 size={15}/>Xóa Brand Profile</button>}</aside>
    </div>
    <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Tạo Brand Profile" description="Brand mới có thể dùng ngay để clone template."><label className="field"><span>Tên thương hiệu</span><input className="input" autoFocus value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="Ví dụ: Lumi Beauty Academy"/></label><div className="modal-actions"><button className="btn btn-secondary" onClick={() => setCreateOpen(false)}>Hủy</button><button className="btn btn-primary" onClick={create}><Plus size={15}/>Tạo Brand</button></div></Modal>
  </AppShell>;
}

async function loadBrandImage(event: React.ChangeEvent<HTMLInputElement>, callback: (assetId: string, previewUrl: string) => void) { const file = event.target.files?.[0]; if (!file) return; const asset = await uploadAsset(file, { organizationId: useAppStore.getState().workspace.id, category: "brand-assets", assetType: "brand-image" }); callback(asset.assetId, asset.previewUrl); }
