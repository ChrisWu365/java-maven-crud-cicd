import { useEffect, useState } from 'react';
import { api, type Inspection, type Observation, type Status, type User } from './api';

const statuses: Status[] = ['DRAFT', 'IN_PROGRESS', 'ACTION_REQUIRED', 'COMPLETED'];

export function App() {
  const [user, setUser] = useState<User | null>(() => JSON.parse(localStorage.getItem('inspection-user') ?? 'null'));
  const [selected, setSelected] = useState<Inspection | null>(null);
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function refresh() {
    setLoading(true);
    try { setInspections(await api.list()); setError(''); }
    catch (err) { setError(err instanceof Error ? err.message : 'Unable to load inspections'); }
    finally { setLoading(false); }
  }

  useEffect(() => { if (user) void refresh(); }, [user]);

  if (!user) return <Login onLogin={(nextUser, token) => {
    localStorage.setItem('inspection-token', token);
    localStorage.setItem('inspection-user', JSON.stringify(nextUser));
    setUser(nextUser);
  }} />;

  return (
    <div className="app-shell">
      <header className="topbar">
        <div><span className="eyebrow">PASSIVE FIRE / FIELD DEMO</span><h1>Inspection workspace</h1></div>
        <div className="user-menu"><span>{user.name} · <strong>{user.role}</strong></span><button className="button ghost" onClick={() => { localStorage.clear(); setUser(null); }}>Sign out</button></div>
      </header>
      <main className="content">
        <section className="hero">
          <div><span className="eyebrow">COMPLIANCE OPERATIONS</span><h2>Make every inspection traceable.</h2><p>Capture evidence, surface observations and keep a human in the loop.</p></div>
          {user.role !== 'VIEWER' && <button className="button primary" onClick={() => setSelected(emptyInspection())}>+ New inspection</button>}
        </section>
        {error && <div className="alert error">{error}</div>}
        <div className="stats">
          <Stat label="Total inspections" value={inspections.length} />
          <Stat label="Action required" value={inspections.filter((item) => item.status === 'ACTION_REQUIRED').length} tone="warning" />
          <Stat label="Completed" value={inspections.filter((item) => item.status === 'COMPLETED').length} tone="success" />
        </div>
        <section className="panel">
          <div className="panel-heading"><div><h3>Recent inspections</h3><span className="muted">Evidence register · {loading ? 'Refreshing…' : `${inspections.length} records`}</span></div></div>
          <div className="table-wrap"><table><thead><tr><th>Building / location</th><th>Status</th><th>Inspector</th><th>Updated</th><th /></tr></thead>
            <tbody>{inspections.map((inspection) => <tr key={inspection.id}><td><strong>{inspection.building}</strong><span className="subline">{inspection.location}</span></td><td><StatusBadge status={inspection.status} /></td><td>{inspection.inspectorName}</td><td>{new Date(inspection.updatedAt).toLocaleDateString()}</td><td><button className="button link" onClick={() => setSelected(inspection)}>Open</button></td></tr>)}</tbody>
          </table></div>
        </section>
      </main>
      {selected && <InspectionModal initial={selected} canEdit={user.role !== 'VIEWER'} onClose={() => setSelected(null)} onSaved={(saved) => { setSelected(saved); void refresh(); }} />}
    </div>
  );
}

function Login({ onLogin }: { onLogin: (user: User, token: string) => void }) {
  const [email, setEmail] = useState('inspector@example.com');
  const [password, setPassword] = useState('Inspector123!');
  const [error, setError] = useState('');
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    try { const result = await api.login(email, password); onLogin(result.user, result.token); }
    catch (err) { setError(err instanceof Error ? err.message : 'Login failed'); }
  };
  return <div className="login-page"><div className="login-card"><span className="eyebrow">PASSIVE FIRE / FIELD DEMO</span><h1>Inspection workspace</h1><p className="muted">A focused demo for evidence-led passive fire inspections.</p><form onSubmit={submit}><label>Email<input value={email} onChange={(event) => setEmail(event.target.value)} type="email" required /></label><label>Password<input value={password} onChange={(event) => setPassword(event.target.value)} type="password" required /></label>{error && <div className="alert error">{error}</div>}<button className="button primary full">Sign in</button></form><div className="demo-hint"><strong>Development demo accounts</strong><br />Inspector: inspector@example.com / Inspector123!<br />Viewer: viewer@example.com / Viewer123!</div></div></div>;
}

function InspectionModal({ initial, canEdit, onClose, onSaved }: { initial: Inspection; canEdit: boolean; onClose: () => void; onSaved: (inspection: Inspection) => void }) {
  const [form, setForm] = useState<Inspection>(initial);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [aiInstruction, setAiInstruction] = useState('Provide a concise, non-definitive passive fire inspection observation draft. Never decide compliance. State that a qualified human must verify the result.');
  const isNew = !initial.id;
  const update = (patch: Partial<Inspection>) => setForm((current) => ({ ...current, ...patch }));
  const save = async () => {
    setSaving(true); setError('');
    try { const saved = await api.save(form, isNew ? undefined : form.id); onSaved(saved); setForm(saved); setMessage('Saved'); }
    catch (err) { setError(err instanceof Error ? err.message : 'Save failed'); }
    finally { setSaving(false); }
  };
  const addObservation = () => update({ observations: [...form.observations, { description: '', severity: 'MEDIUM', remedialAction: '' }] });
  const updateObservation = (index: number, patch: Partial<Observation>) => update({ observations: form.observations.map((item, current) => current === index ? { ...item, ...patch } : item) });
  const runAi = async () => {
    if (!form.id) { setError('Save the inspection before requesting an AI suggestion.'); return; }
    try { const result = await api.aiSummary(form.id, aiInstruction); setForm(result.inspection); setMessage(`AI ${result.source} suggestion added — human review required.`); }
    catch (err) { setError(err instanceof Error ? err.message : 'AI suggestion failed'); }
  };
  const upload = async (files: FileList | null) => {
    if (!files || isNew) return;
    const fileArray = Array.from(files);
    if (fileArray.length > 5) {
      setError('Maximum 5 photos allowed per inspection');
      return;
    }
    const maxSize = 10 * 1024 * 1024; // 10MB
    const oversizedFile = fileArray.find(file => file.size > maxSize);
    if (oversizedFile) {
      setError(`File ${oversizedFile.name} exceeds 10MB limit`);
      return;
    }
    if (form.photos.length + fileArray.length > 5) {
      setError(`Cannot add ${fileArray.length} photo(s). Maximum 5 photos total per inspection.`);
      return;
    }
    try { setForm(await api.upload(form.id, files)); } catch (err) { setError(err instanceof Error ? err.message : 'Upload failed'); }
  };
  const deletePhoto = async (photoIndex: number) => {
    try { setForm(await api.deletePhoto(form.id, photoIndex)); }
    catch (err) { setError(err instanceof Error ? err.message : 'Delete photo failed'); }
  };
  return <div className="modal-backdrop"><article className="modal"><div className="modal-header"><div><span className="eyebrow">INSPECTION RECORD</span><h2>{isNew ? 'New inspection' : form.building}</h2></div><button className="icon-button" onClick={onClose}>×</button></div>{error && <div className="alert error">{error}</div>}{message && <div className="alert success">{message}</div>}<div className="form-grid"><label>Building / project<input disabled={!canEdit} value={form.building} onChange={(event) => update({ building: event.target.value })} /></label><label>Location<input disabled={!canEdit} value={form.location} onChange={(event) => update({ location: event.target.value })} /></label><label>Status<select disabled={!canEdit} value={form.status} onChange={(event) => update({ status: event.target.value as Status })}>{statuses.map((status) => <option key={status}>{status}</option>)}</select></label></div><label>Inspection notes<textarea disabled={!canEdit} rows={4} value={form.notes} onChange={(event) => update({ notes: event.target.value })} placeholder="What was inspected, and what evidence was reviewed?" /></label><div className="section-heading"><h3>Observations & remedial actions</h3>{canEdit && <button className="button secondary" onClick={addObservation}>+ Add observation</button>}</div>{form.observations.map((observation, index) => <div className="observation" key={observation.id ?? index}><textarea disabled={!canEdit} rows={2} value={observation.description} onChange={(event) => updateObservation(index, { description: event.target.value })} placeholder="Observation" /><div className="observation-row"><select disabled={!canEdit} value={observation.severity} onChange={(event) => updateObservation(index, { severity: event.target.value as Observation['severity'] })}><option>LOW</option><option>MEDIUM</option><option>HIGH</option></select><input disabled={!canEdit} value={observation.remedialAction} onChange={(event) => updateObservation(index, { remedialAction: event.target.value })} placeholder="Recommended remedial action" /></div></div>)}<label>Site photos {canEdit && <input disabled={isNew} type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => void upload(event.target.files)} />}</label>{form.photos.length > 0 && <div className="photo-list">{form.photos.map((photo, index) => <div key={photo} className="photo-item"><img src={photo} alt="Inspection evidence" />{canEdit && <button className="button ghost photo-delete" onClick={() => void deletePhoto(index)}>×</button>}</div>)}</div>}{form.aiSummary && <div className="ai-note"><strong>AI-assisted draft — unverified</strong><p>{form.aiSummary}</p><small>Human inspection and professional judgement are required. This suggestion is not a compliance decision.</small></div>}<div className="modal-actions">{canEdit && <><label>AI instruction<textarea disabled={!canEdit} rows={2} value={aiInstruction} onChange={(event) => setAiInstruction(event.target.value)} placeholder="Provide a concise, non-definitive passive fire inspection observation draft. Never decide compliance. State that a qualified human must verify the result." /></label><button className="button secondary" onClick={() => void runAi()}>✦ Generate AI draft</button><button className="button primary" disabled={saving} onClick={() => void save()}>{saving ? 'Saving…' : 'Save inspection'}</button></>}{!isNew && <button className="button ghost" onClick={() => window.print()}>Print report</button>}<button className="button ghost" onClick={onClose}>Close</button></div></article></div>;
}

function emptyInspection(): Inspection { return { id: '', building: '', location: '', notes: '', status: 'DRAFT', inspectorName: '', observations: [], photos: [], updatedAt: '' }; }
function Stat({ label, value, tone = '' }: { label: string; value: number; tone?: string }) { return <div className={`stat ${tone}`}><span>{label}</span><strong>{value}</strong></div>; }
function StatusBadge({ status }: { status: Status }) { return <span className={`status ${status.toLowerCase()}`}>{status.replace('_', ' ')}</span>; }
