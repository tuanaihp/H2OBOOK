"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Group, Image as KonvaImage, Layer, Line, Rect, Stage, Text, Transformer } from "react-konva";
import Konva from "konva";
import { useEditorStore } from "@/store/editor-store";
import type { H2OElement } from "@/types/editor";
import { resolveAssetUrl } from "@/lib/assets/asset-client";

const minSize = 18;

function snap(value: number, enabled: boolean, size: number) {
  return enabled ? Math.round(value / size) * size : value;
}

function imageCrop(image: HTMLImageElement, width: number, height: number, fit: H2OElement["imageFit"]) {
  if (fit !== "cover") return undefined;
  const targetRatio = width / height;
  const imageRatio = image.width / image.height;
  if (imageRatio > targetRatio) {
    const cropWidth = image.height * targetRatio;
    return { x: (image.width - cropWidth) / 2, y: 0, width: cropWidth, height: image.height };
  }
  const cropHeight = image.width / targetRatio;
  return { x: 0, y: (image.height - cropHeight) / 2, width: image.width, height: cropHeight };
}

type NodeProps = {
  element: H2OElement;
  selected: boolean;
  onSelect: (additive?: boolean) => void;
  onChange: (patch: Partial<H2OElement>, record?: boolean) => void;
  snapToGrid: boolean;
  gridSize: number;
};

function SelectionTransformer({ node, element }: { node: Konva.Node | null; element: H2OElement }) {
  const transformer = useRef<Konva.Transformer>(null);
  useEffect(() => {
    if (node && transformer.current) {
      transformer.current.nodes([node]);
      transformer.current.getLayer()?.batchDraw();
    }
  }, [node]);
  if (!node || element.locked || !element.permissions.canResize) return null;
  return <Transformer
    ref={transformer}
    rotateEnabled={element.permissions.canRotate !== false}
    keepRatio={element.type === "qr"}
    enabledAnchors={element.type === "line" ? ["middle-left", "middle-right"] : undefined}
    anchorSize={9}
    anchorCornerRadius={3}
    borderStroke="#7d2d55"
    anchorFill="#ffffff"
    anchorStroke="#7d2d55"
    boundBoxFunc={(oldBox, nextBox) => nextBox.width < minSize || nextBox.height < minSize ? oldBox : nextBox}
  />;
}

function CanvasImage({ element, selected, onSelect, onChange, snapToGrid, gridSize }: NodeProps) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const nodeRef = useRef<Konva.Image>(null);
  useEffect(() => {
    let cancelled = false;
    let resolvedUrl: string | null = null;
    const load = async () => {
      resolvedUrl = element.imageUrl ?? (element.assetId ? await resolveAssetUrl(element.assetId) : null);
      if (!resolvedUrl || cancelled) { if (!cancelled) setImage(null); return; }
      const img = new window.Image();
      img.crossOrigin = "anonymous";
      img.onload = () => { if (!cancelled) setImage(img); };
      img.src = resolvedUrl;
    };
    void load();
    return () => { cancelled = true; if (resolvedUrl?.startsWith("blob:")) URL.revokeObjectURL(resolvedUrl); };
  }, [element.assetId, element.imageUrl]);
  const crop = image ? imageCrop(image, element.width, element.height, element.imageFit) : undefined;
  return <>
    <KonvaImage
      ref={nodeRef}
      image={image ?? undefined}
      crop={crop}
      x={element.x} y={element.y} width={element.width} height={element.height}
      rotation={element.rotation} opacity={element.opacity} cornerRadius={element.cornerRadius ?? 0}
      visible={!element.hidden} draggable={!element.locked && element.permissions.canMove}
      shadowColor={element.shadow?.color} shadowBlur={element.shadow?.blur} shadowOffsetX={element.shadow?.offsetX}
      shadowOffsetY={element.shadow?.offsetY} shadowOpacity={element.shadow?.opacity}
      onClick={(event) => onSelect(Boolean(event.evt.shiftKey || event.evt.metaKey || event.evt.ctrlKey))}
      onTap={() => onSelect(false)}
      onDragEnd={(event) => onChange({ x: snap(event.target.x(), snapToGrid, gridSize), y: snap(event.target.y(), snapToGrid, gridSize) })}
      onTransformEnd={() => {
        const node = nodeRef.current; if (!node) return;
        const scaleX = node.scaleX(); const scaleY = node.scaleY(); node.scaleX(1); node.scaleY(1);
        onChange({ x: snap(node.x(), snapToGrid, gridSize), y: snap(node.y(), snapToGrid, gridSize), width: Math.max(minSize, snap(node.width() * scaleX, snapToGrid, gridSize)), height: Math.max(minSize, snap(node.height() * scaleY, snapToGrid, gridSize)), rotation: node.rotation() });
      }}
    />
    {selected && <SelectionTransformer node={nodeRef.current} element={element}/>} 
  </>;
}

function QrNode({ element, selected, onSelect, onChange, snapToGrid, gridSize }: NodeProps) {
  const [image,setImage]=useState<HTMLImageElement|null>(null);
  const ref=useRef<Konva.Image>(null);
  useEffect(()=>{let cancelled=false;void import("qrcode").then((module)=>module.toDataURL(element.qrValue??"https://h2obook.vn",{errorCorrectionLevel:"H",margin:1,width:512,color:{dark:element.fill??"#222222",light:"#ffffff"}})).then((url)=>{if(cancelled)return;const img=new window.Image();img.onload=()=>{if(!cancelled)setImage(img)};img.src=url;}).catch(()=>setImage(null));return()=>{cancelled=true};},[element.qrValue,element.fill]);
  return <>
    <KonvaImage ref={ref} image={image??undefined} x={element.x} y={element.y} width={element.width} height={element.height} rotation={element.rotation} opacity={element.opacity} visible={!element.hidden} draggable={!element.locked&&element.permissions.canMove}
      onClick={(event)=>onSelect(Boolean(event.evt.shiftKey||event.evt.metaKey||event.evt.ctrlKey))} onTap={()=>onSelect(false)}
      onDragEnd={(event)=>onChange({x:snap(event.target.x(),snapToGrid,gridSize),y:snap(event.target.y(),snapToGrid,gridSize)})}
      onTransformEnd={()=>{const node=ref.current;if(!node)return;const scale=Math.max(node.scaleX(),node.scaleY());node.scaleX(1);node.scaleY(1);const size=Math.max(80,snap(element.width*scale,snapToGrid,gridSize));onChange({x:snap(node.x(),snapToGrid,gridSize),y:snap(node.y(),snapToGrid,gridSize),width:size,height:size,rotation:node.rotation()});}}/>
    {selected&&<SelectionTransformer node={ref.current} element={element}/>}
  </>;
}

function CanvasNode(props: NodeProps) {
  const { element, selected, onSelect, onChange, snapToGrid, gridSize } = props;
  const nodeRef = useRef<Konva.Node>(null);
  if (element.type === "image") return <CanvasImage {...props}/>;
  if (element.type === "qr") return <QrNode {...props}/>;
  const common = {
    ref: nodeRef as never,
    x: element.x, y: element.y, width: element.width, height: element.height,
    rotation: element.rotation, opacity: element.opacity, visible: !element.hidden,
    draggable: !element.locked && element.permissions.canMove,
    shadowColor: element.shadow?.color, shadowBlur: element.shadow?.blur,
    shadowOffsetX: element.shadow?.offsetX, shadowOffsetY: element.shadow?.offsetY, shadowOpacity: element.shadow?.opacity,
    onClick: (event: Konva.KonvaEventObject<MouseEvent>) => onSelect(Boolean(event.evt.shiftKey || event.evt.metaKey || event.evt.ctrlKey)),
    onTap: () => onSelect(false),
    onDragEnd: (event: Konva.KonvaEventObject<DragEvent>) => onChange({ x: snap(event.target.x(), snapToGrid, gridSize), y: snap(event.target.y(), snapToGrid, gridSize) }),
    onTransformEnd: () => {
      const node = nodeRef.current; if (!node) return;
      const scaleX = node.scaleX(); const scaleY = node.scaleY(); node.scaleX(1); node.scaleY(1);
      onChange({ x: snap(node.x(), snapToGrid, gridSize), y: snap(node.y(), snapToGrid, gridSize), width: Math.max(minSize, snap(node.width() * scaleX, snapToGrid, gridSize)), height: Math.max(element.type === "line" ? 2 : minSize, snap(node.height() * scaleY, snapToGrid, gridSize)), rotation: node.rotation() });
    }
  };
  return <>
    {element.type === "text" ? <Text
      {...common}
      text={element.text ?? ""} fill={element.fill ?? "#222"}
      fontSize={element.fontSize ?? 24} fontFamily={element.fontFamily ?? "Arial"}
      fontStyle={`${(element.fontWeight ?? 400) >= 700 ? "bold" : "normal"}${element.fontStyle === "italic" ? " italic" : ""}`}
      textDecoration={element.textDecoration === "none" ? undefined : element.textDecoration}
      align={element.align ?? "left"} verticalAlign={element.verticalAlign ?? "top"}
      lineHeight={element.lineHeight ?? 1.35} letterSpacing={element.letterSpacing ?? 0} padding={element.flowPadding ?? 2}
    /> : <Rect
      {...common}
      fill={element.fill ?? "#dddddd"} stroke={element.stroke} strokeWidth={element.strokeWidth ?? 0}
      dash={element.dash} cornerRadius={element.cornerRadius ?? 0}
    />}
    {element.type === "text" && element.flowChainId && <Group listening={false}>
      <Rect x={element.x + Math.max(0, element.width - 102)} y={Math.max(2, element.y - 23)} width={102} height={20} cornerRadius={7} fill={element.flowOverflow ? "#c73d4b" : "#5b4bc4"} opacity={0.96}/>
      <Text x={element.x + Math.max(0, element.width - 98)} y={Math.max(5, element.y - 20)} width={94} height={14} text={element.flowOverflow ? "TRÀN NỘI DUNG" : `FLOW ${(element.flowOrder ?? 0) + 1}`} fill="#ffffff" fontSize={9} fontStyle="bold" align="center"/>
      {element.flowOverflow && <Rect x={element.x} y={element.y} width={element.width} height={element.height} stroke="#d8394e" strokeWidth={2} dash={[8, 5]} cornerRadius={4}/>} 
    </Group>}
    {selected && <SelectionTransformer node={nodeRef.current} element={element}/>} 
  </>;
}

export function EditorCanvas() {
  const store = useEditorStore();
  const page = store.book.pages.find((item) => item.id === store.activePageId) ?? store.book.pages[0];
  const stageRef = useRef<Konva.Stage>(null);

  useEffect(() => {
    const exportHandler = () => {
      const url = stageRef.current?.toDataURL({ pixelRatio: 2 }); if (!url || !page) return;
      const anchor = document.createElement("a"); anchor.href = url; anchor.download = `${store.book.title}-${page.name}.png`; anchor.click();
    };
    window.addEventListener("h2obook:export-page", exportHandler);
    return () => window.removeEventListener("h2obook:export-page", exportHandler);
  }, [store.book.title, page]);

  if (!page) return null;
  const gridLines = store.showGrid ? [
    ...Array.from({ length: Math.ceil(page.width / store.gridSize) + 1 }, (_, index) => <Line key={`v${index}`} points={[index * store.gridSize, 0, index * store.gridSize, page.height]} stroke="#6f1d46" strokeWidth={0.35} opacity={0.14} listening={false}/>),
    ...Array.from({ length: Math.ceil(page.height / store.gridSize) + 1 }, (_, index) => <Line key={`h${index}`} points={[0, index * store.gridSize, page.width, index * store.gridSize]} stroke="#6f1d46" strokeWidth={0.35} opacity={0.14} listening={false}/>)
  ] : null;

  return <div className="canvas-wrap" style={{ width: page.width * store.zoom, height: page.height * store.zoom }}>
    <Stage
      ref={stageRef} width={page.width * store.zoom} height={page.height * store.zoom}
      onMouseDown={(event) => { if (event.target === event.target.getStage()) store.clearSelection(); }}
      onTap={(event) => { if (event.target === event.target.getStage()) store.clearSelection(); }}
    >
      <Layer scaleX={store.zoom} scaleY={store.zoom}>
        <Rect x={0} y={0} width={page.width} height={page.height} fill={page.background}/>
        {gridLines}
        {page.elements.map((element) => <CanvasNode
          key={element.id} element={element} selected={store.selectedIds.includes(element.id)}
          onSelect={(additive) => store.setSelected(element.id, additive)}
          onChange={(patch, record) => store.updateElement(element.id, patch, record)}
          snapToGrid={store.snapToGrid} gridSize={store.gridSize}
        />)}
      </Layer>
    </Stage>
  </div>;
}
