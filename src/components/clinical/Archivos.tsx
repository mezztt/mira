import { useCallback, useEffect, useMemo, useState } from "react";
import { appApi, appBlob, appUpload, dateTime, FILE_CATEGORIES } from "../../config";
import type { PatientFileItem } from "../../config";
import { Empty, Field, Loading, Modal, Pill, Seg } from "../ui";

interface FilesData { items: PatientFileItem[]; can_write: boolean; max_mb: number }
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const CAT_TONE: Record<string, string> = { ESTUDIO: "blue", RADIOGRAFIA: "violet", IMAGEN: "teal", OTRO: "gray" };

function sizeLabel(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** Miniatura hecha en el navegador (JPG chico) para la grilla */
function makeThumb(file: File): Promise<Blob | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, 320 / Math.max(img.width, img.height, 1));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = canvas.getContext("2d");
      URL.revokeObjectURL(url);
      if (!ctx) { resolve(null); return; }
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((b) => resolve(b), "image/jpeg", 0.72);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    img.src = url;
  });
}

/**
 * Estudios y archivos del paciente (parte de la historia clínica): estudios, radiografías, fotos.
 * No se editan ni se borran: se anulan con motivo. Ver y subir queda registrado.
 */
export default function Archivos({ patientId, onSaved }: { patientId: number; onSaved?: (msg: string) => void }) {
  const [data, setData] = useState<FilesData | null>(null);
  const [error, setError] = useState("");
  const [category, setCategory] = useState("");
  const [showVoided, setShowVoided] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [viewer, setViewer] = useState<{ file: PatientFileItem; url: string | null } | null>(null);
  const [voiding, setVoiding] = useState<PatientFileItem | null>(null);
  const [opening, setOpening] = useState<number | null>(null);

  const load = useCallback(() => {
    appApi<FilesData>(`/patients/${patientId}/files`).then(setData).catch((e) => setError(e.message));
  }, [patientId]);
  useEffect(() => { load(); }, [load]);

  const visible = useMemo(() => (data?.items || []).filter((f) => (!category || f.category === category) && (showVoided || !f.voided)), [data, category, showVoided]);
  const voidedCount = (data?.items || []).filter((f) => f.voided).length;

  async function open(f: PatientFileItem) {
    setError("");
    if (f.is_image) {
      setViewer({ file: f, url: null });
      try {
        const blob = await appBlob(`/patient-files/${f.id}/download`);
        setViewer({ file: f, url: URL.createObjectURL(blob) });
      } catch (e) { setViewer(null); setError(e instanceof Error ? e.message : "No se pudo abrir el archivo"); }
      return;
    }
    // PDF: la pestaña se abre ya (si no, el navegador la bloquea) y se le carga el archivo cuando llega
    const tab = window.open("", "_blank");
    setOpening(f.id);
    try {
      const blob = await appBlob(`/patient-files/${f.id}/download`);
      const url = URL.createObjectURL(blob);
      if (tab) tab.location.href = url; else window.location.href = url;
      window.setTimeout(() => URL.revokeObjectURL(url), 120000);
    } catch (e) {
      tab?.close();
      setError(e instanceof Error ? e.message : "No se pudo abrir el archivo");
    } finally { setOpening(null); }
  }

  function closeViewer() {
    if (viewer?.url) URL.revokeObjectURL(viewer.url);
    setViewer(null);
  }

  if (!data) return error ? <div className="mr-note mr-note-error">{error}</div> : <Loading />;

  return (
    <div>
      <div className="mr-toolbar">
        <div className="mr-row">
          {data.can_write
            ? <button className="primary-button" onClick={() => setUploading(true)}>+ Subir archivo</button>
            : <span className="mr-note mr-note-info">Solo los profesionales suben archivos a la historia clínica.</span>}
        </div>
        <div className="mr-row">
          <Seg value={category} onChange={setCategory} options={[["", "Todos"], ...Object.entries(FILE_CATEGORIES)] as [string, string][]} />
          {voidedCount > 0 && (
            <label className="mr-inline-checks" style={{ paddingTop: 0 }}>
              <input type="checkbox" checked={showVoided} onChange={(e) => setShowVoided(e.target.checked)} /> Ver anulados ({voidedCount})
            </label>
          )}
        </div>
      </div>
      {error && <div className="mr-note mr-note-error" style={{ marginBottom: 12 }}>{error}</div>}

      {visible.length === 0 ? (
        <Empty title={data.items.length ? "No hay archivos con ese filtro" : "Todavía no hay estudios ni archivos"}>
          {data.can_write ? "Subí estudios, radiografías o fotos con “Subir archivo”." : "Los sube el profesional desde su usuario."}
        </Empty>
      ) : (
        <div className="mr-files-grid">
          {visible.map((f) => (
            <article key={f.id} className={`mr-file-card ${f.voided ? "is-void" : ""}`}>
              <button type="button" className="mr-file-thumb" onClick={() => open(f)} disabled={opening === f.id}
                aria-label={`Abrir ${f.name}`} title={f.is_image ? "Ver imagen" : "Abrir PDF en otra pestaña"}>
                {f.thumb ? <img src={f.thumb} alt="" /> : <span aria-hidden="true">{f.is_image ? "🖼" : "PDF"}</span>}
              </button>
              <div className="mr-file-body">
                <strong title={f.name}>{f.name}</strong>
                <div className="mr-row" style={{ gap: 6 }}>
                  <Pill tone={CAT_TONE[f.category] || "gray"}>{FILE_CATEGORIES[f.category] || f.category}</Pill>
                  {f.voided && <Pill tone="red">Anulado</Pill>}
                </div>
                <small>{dateTime(f.created_at)} · {sizeLabel(f.size)}</small>
                <small>Subió: {f.author_name || f.professional_name || "—"}</small>
                {f.note && <p>{f.note}</p>}
                {f.voided
                  ? <small>Anulado por {f.voided_by_name || "—"}: {f.void_reason}</small>
                  : data.can_write && <button type="button" className="mr-link mr-link-danger" onClick={() => setVoiding(f)}>Anular</button>}
              </div>
            </article>
          ))}
        </div>
      )}

      <p className="mr-legal" style={{ marginTop: 16 }}>
        Los archivos forman parte de la historia clínica: no se modifican ni se borran. Si uno se subió por error se anula con el motivo
        y queda a la vista como anulado. Cada vez que alguien abre un archivo queda registrado.
      </p>

      {uploading && <UploadForm patientId={patientId} maxMb={data.max_mb} onClose={() => setUploading(false)}
        onSaved={() => { setUploading(false); load(); onSaved?.("Archivo guardado en la historia clínica"); }} />}

      {viewer && (
        <Modal eyebrow={(FILE_CATEGORIES[viewer.file.category] || "ARCHIVO").toUpperCase()} title={viewer.file.name} onClose={closeViewer} size="xl"
          footer={<button className="secondary-button" onClick={closeViewer}>Cerrar</button>}>
          <div className="mr-file-viewer">
            {viewer.url ? <img src={viewer.url} alt={viewer.file.note || viewer.file.name} /> : <Loading text="Abriendo imagen..." />}
          </div>
          <p className="mr-muted">{dateTime(viewer.file.created_at)} · {viewer.file.author_name || "—"}{viewer.file.note ? ` · ${viewer.file.note}` : ""}</p>
        </Modal>
      )}

      {voiding && <VoidForm file={voiding} onClose={() => setVoiding(null)}
        onSaved={() => { setVoiding(null); load(); onSaved?.("Archivo anulado"); }} />}
    </div>
  );
}

function UploadForm({ patientId, maxMb, onClose, onSaved }: { patientId: number; maxMb: number; onClose: () => void; onSaved: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [category, setCategory] = useState("ESTUDIO");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function pick(f: File | undefined) {
    setError("");
    if (!f) { setFile(null); return; }
    if (!ALLOWED.includes(f.type)) { setFile(null); setError("Solo se pueden subir imágenes (JPG, PNG, WEBP) o PDF."); return; }
    if (f.size > maxMb * 1024 * 1024) { setFile(null); setError(`El archivo pesa ${sizeLabel(f.size)}: el máximo es ${maxMb} MB.`); return; }
    setFile(f);
    if (f.type.startsWith("image/") && category === "ESTUDIO") setCategory("IMAGEN");
  }

  async function save() {
    if (!file) return setError("Elegí el archivo");
    setError("");
    setSaving(true);
    try {
      const form = new FormData();
      form.append("file", file, file.name);
      form.append("category", category);
      form.append("note", note.trim());
      if (file.type.startsWith("image/")) {
        const thumb = await makeThumb(file);
        if (thumb && thumb.size <= 80 * 1024) form.append("thumb", thumb, "miniatura.jpg");
      }
      await appUpload(`/patients/${patientId}/files`, form);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo subir");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal eyebrow="HISTORIA CLÍNICA" title="Subir estudio o archivo" onClose={onClose}
      footer={<>
        <button className="secondary-button" onClick={onClose}>Cancelar</button>
        <button className="primary-button" onClick={save} disabled={saving || !file}>{saving ? "Subiendo..." : "Subir archivo"}</button>
      </>}>
      <div className="product-form">
        <Field label="Archivo" hint={`Imágenes (JPG, PNG, WEBP) o PDF, hasta ${maxMb} MB.`}>
          <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(e) => pick(e.target.files?.[0])} />
        </Field>
        <Field label="Tipo">
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            {Object.entries(FILE_CATEGORIES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </Field>
        <Field label="Nota (opcional)"><input value={note} onChange={(e) => setNote(e.target.value)} maxLength={255} placeholder="Ej. Panorámica previa al tratamiento" /></Field>
        <div className="mr-note mr-note-warn">Una vez subido no se puede cambiar ni borrar (sí anular con motivo). Revisá que sea de este paciente.</div>
        {error && <div className="mr-note mr-note-error">{error}</div>}
      </div>
    </Modal>
  );
}

function VoidForm({ file, onClose, onSaved }: { file: PatientFileItem; onClose: () => void; onSaved: () => void }) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  async function save() {
    if (reason.trim().length < 3) return setError("Escribí el motivo");
    setSaving(true);
    try {
      await appApi(`/patient-files/${file.id}/void`, { method: "POST", body: { reason: reason.trim() } });
      onSaved();
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo anular"); } finally { setSaving(false); }
  }
  return (
    <Modal eyebrow="ANULAR ARCHIVO" title={file.name} onClose={onClose}
      footer={<>
        <button className="secondary-button" onClick={onClose}>Cancelar</button>
        <button className="mr-danger-button" onClick={save} disabled={saving}>{saving ? "Anulando..." : "Anular archivo"}</button>
      </>}>
      <div className="product-form">
        <p className="mr-muted" style={{ marginTop: 0 }}>El archivo no se borra: queda marcado como anulado, con el motivo y quién lo anuló.</p>
        <Field label="Motivo"><input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={255} placeholder="Ej. se subió al paciente equivocado" autoFocus /></Field>
        {error && <div className="mr-note mr-note-error">{error}</div>}
      </div>
    </Modal>
  );
}
