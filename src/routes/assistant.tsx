import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useEffect, useRef, useState } from "react";
import { Send, Sparkles, Pencil, Check, Bot, User2 } from "lucide-react";
import { toast } from "sonner";
import { Guard } from "@/components/Guard";
import { Page } from "@/components/AppShell";
import { Button, Card, Field, Input, Spinner, Textarea } from "@/components/ui-kit";
import { CATEGORIES, categoryLabel, useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { extractRequest, type ExtractedRequest } from "@/lib/requests.functions";

const PURPOSES = ["Programming & Development","Graphic & Visual Design","Office & Administrative Work","Web Browsing & Communication","Content Creation & Editing","Studying & Academic Research","Gaming & Entertainment","Data Analysis & Processing","Video Editing & Post-Production"] as const;
const DELIVERY_OPTIONS = ["Deliver", "Hand-to-hand receipt"] as const;
const RAM_OPTIONS = ["4 GB", "8 GB", "16 GB", "24 GB", "32 GB", "64 GB+"] as const;
const PROCESSOR_OPTIONS = ["Intel Core i3/i5/i7/i9/Ultra", "AMD Ryzen 3/5/7/9", "Apple M-Series", "Other"] as const;
const SCREEN_OPTIONS = ["11.6\"", "13.3\"", "14.0\"", "15.6\"", "16.0\"", "17.3\"", "Other"] as const;
const HINGE_OPTIONS = ["Standard (up to 130°)", "Lay-Flat (180° Hinge)", "2-in-1 Convertible (360° Touchscreen)"] as const;
const CAMERA_OPTIONS = ["720p HD", "1080p Full HD", "1440p/2K", "4K", "No Camera"] as const;
const BATTERY_OPTIONS = ["Up to 3 hours", "3 - 5 hours", "5 - 8 hours", "8 - 12 hours", "12+ hours"] as const;
const BUDGET_INPUT_MAX = 50000;

type TechnicalSpecs = { ram:string; processor:string; processor_other:string; screen_size:string; screen_other:string; hinge_style:string; camera_resolution:string; battery_life:string; dedicated_gpu:boolean; gpu_model_vram:string };
const emptyTechnicalSpecs: TechnicalSpecs = { ram:"",processor:"",processor_other:"",screen_size:"",screen_other:"",hinge_style:"",camera_resolution:"",battery_life:"",dedicated_gpu:false,gpu_model_vram:"" };
type RequestDraft = ExtractedRequest & { purposes: string[] };

export const Route = createFileRoute("/assistant")({
  head: () => ({ meta: [
    { title: "AI shopping assistant — Ateeq" },
    { name: "description", content: "Describe the electronics you need in plain words and the assistant turns it into a supplier request." },
    { property: "og:title", content: "AI shopping assistant — Ateeq" },
    { property: "og:description", content: "Chat naturally and get competing offers from verified suppliers." },
  ] }),
  component: () => <Guard roles={["customer", "admin"]}>{(ctx) => <Assistant userId={ctx.userId} />}</Guard>,
});

function SelectField({ value, onChange, options, placeholder }: { value:string; onChange:(v:string)=>void; options:readonly string[]; placeholder:string }) {
  return <select value={value} onChange={(e)=>onChange(e.target.value)} className="h-11 w-full rounded-xl border border-input bg-card px-3 text-sm"><option value="">{placeholder}</option>{options.map((o)=><option key={o} value={o}>{o}</option>)}</select>;
}

function Assistant({ userId }: { userId: string }) {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const [input, setInput] = useState("");
  const [draft, setDraft] = useState<RequestDraft | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [brandOptions, setBrandOptions] = useState<string[]>([]);
  const [brandOther, setBrandOther] = useState("");
  const [purposeOther, setPurposeOther] = useState("");
  const [technicalSpecs, setTechnicalSpecs] = useState<TechnicalSpecs>(emptyTechnicalSpecs);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { messages, sendMessage, status } = useChat({ transport: new DefaultChatTransport({ api: "/api/chat" }), onError: (e) => toast.error(e.message) });
  const busy = status === "submitted" || status === "streaming";
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, busy, draft]);
  useEffect(() => { if (!busy && !draft) inputRef.current?.focus(); }, [busy, draft]);
  useEffect(() => { if (!draft) return; const loadBrands = async () => { const db=supabase as any; const {data,error}=await db.from("brands").select("name").eq("active",true).order("name"); if(!error)setBrandOptions((data??[]).map((b:{name:string})=>b.name)); }; void loadBrands(); }, [draft]);
  const textOf = (m: (typeof messages)[number]) => m.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
  const submit = (e: React.FormEvent) => { e.preventDefault(); const value=input.trim(); if(!value||busy)return; setInput(""); void sendMessage({text:value}); };
  const review = async () => { if(!messages.length)return; setReviewing(true); try { const transcript=messages.map((m)=>`${m.role === "user" ? "Customer" : "Assistant"}: ${textOf(m)}`).join("\n"); const result=await extractRequest({data:{transcript,lang}}); setDraft({...result,purposes:result.purpose?[result.purpose]:[]}); } catch(error){toast.error(error instanceof Error?error.message:"Could not read the request");} finally{setReviewing(false);} };
  const toggleBrand=(brand:string)=>{if(!draft)return;setDraft({...draft,brands:draft.brands.includes(brand)?draft.brands.filter(b=>b!==brand):[...draft.brands,brand]});};
  const togglePurpose=(purpose:string)=>{if(!draft)return;setDraft({...draft,purposes:draft.purposes.includes(purpose)?draft.purposes.filter(p=>p!==purpose):[...draft.purposes,purpose]});};
  const updateTech=<K extends keyof TechnicalSpecs>(key:K,value:TechnicalSpecs[K])=>setTechnicalSpecs(s=>({...s,[key]:value}));

  const confirm = async () => {
    if(!draft)return; setSaving(true);
    try {
      const customBrand=brandOther.trim();
      const brands=customBrand&&!draft.brands.includes(customBrand)?[...draft.brands,customBrand]:draft.brands;
      const purposes=draft.purposes.length?draft.purposes:draft.purpose?[draft.purpose]:[];
      const customPurpose=purposeOther.trim();
      const finalPurposes=customPurpose&&!purposes.includes(customPurpose)?[...purposes,customPurpose]:purposes;
      if(customBrand){const db=supabase as any;const {error:brandError}=await db.from("brands").insert({name:customBrand,active:true});if(brandError&&!String(brandError.message).toLowerCase().includes("duplicate"))throw brandError;}
      const cleanTech={...technicalSpecs,processor:technicalSpecs.processor==="Other"?technicalSpecs.processor_other.trim():technicalSpecs.processor,screen_size:technicalSpecs.screen_size==="Other"?technicalSpecs.screen_other.trim():technicalSpecs.screen_size,processor_other:undefined,screen_other:undefined};
      const {data,error}=await (supabase as any).from("purchase_requests").insert({customer_id:userId,title:draft.title,category:draft.category,budget_min:0,budget_max:Number(draft.budget_max??0),specs:draft.specs,technical_specs:cleanTech,purpose:finalPurposes.join(", "),purposes:finalPurposes,brands,warranty_preference:draft.warranty_preference,delivery_preference:draft.delivery_preference,notes:draft.notes,status:"open"}).select("id").single();
      if(error)throw error;
      const {error:convError}=await supabase.from("conversations").insert({customer_id:userId,request_id:data.id,messages:messages.map((m)=>({role:m.role,content:textOf(m)}))}); if(convError)console.error(convError);
      toast.success(t("sent")); navigate({to:"/requests/$id",params:{id:data.id}});
    } catch(error){toast.error(error instanceof Error?error.message:"Could not send the request");} finally{setSaving(false);}
  };

  if(draft){
    const budgetMax=Math.min(Math.max(Number(draft.budget_max??0),0),BUDGET_INPUT_MAX);
    return <Page title={t("summaryTitle")}>
      <Card className="space-y-3">
        <Field label={t("category")}><select value={draft.category} onChange={(e)=>setDraft({...draft,category:e.target.value})} className="h-11 w-full rounded-xl border border-input bg-card px-3 text-sm">{CATEGORIES.map(c=><option key={c} value={c}>{categoryLabel[c]?.[lang]}</option>)}</select></Field>
        <Field label={t("newRequest")}><Input value={draft.title} onChange={(e)=>setDraft({...draft,title:e.target.value})}/></Field>
        <Field label="Maximum Budget"><Input inputMode="decimal" type="number" min={0} max={BUDGET_INPUT_MAX} value={budgetMax||""} onChange={(e)=>{const value=Math.min(Math.max(Number(e.target.value||0),0),BUDGET_INPUT_MAX);setDraft({...draft,budget_min:0,budget_max:value});}} placeholder={`Maximum (${t("currency")})`}/></Field>
        <Field label={t("specs")}><Textarea rows={4} value={draft.specs.join("\n")} onChange={(e)=>setDraft({...draft,specs:e.target.value.split("\n").filter(Boolean)})}/></Field>

        <div className="border-t border-border pt-4"><div className="mb-3"><p className="text-sm font-semibold">{lang === "ar" ? "المواصفات التقنية (اختياري)" : "Technical specifications (Optional)"}</p><p className="text-[10px] text-muted-foreground">{lang === "ar" ? "إذا كنت تعرف المواصفات، يمكنك تعبئتها. المورد يستطيع استكمالها." : "If you know the technical details, you can add them. The supplier can complete them."}</p></div><div className="grid grid-cols-2 gap-3">
          <Field label="RAM (Optional)"><SelectField value={technicalSpecs.ram} onChange={(v)=>updateTech("ram",v)} options={RAM_OPTIONS} placeholder="Select"/></Field>
          <Field label="Processor (Optional)"><SelectField value={technicalSpecs.processor} onChange={(v)=>updateTech("processor",v)} options={PROCESSOR_OPTIONS} placeholder="Select"/>{technicalSpecs.processor==="Other"&&<Input className="mt-2" value={technicalSpecs.processor_other} onChange={(e)=>updateTech("processor_other",e.target.value)} placeholder="Custom processor"/>}</Field>
          <Field label="Screen size (Optional)"><SelectField value={technicalSpecs.screen_size} onChange={(v)=>updateTech("screen_size",v)} options={SCREEN_OPTIONS} placeholder="Select"/>{technicalSpecs.screen_size==="Other"&&<Input className="mt-2" value={technicalSpecs.screen_other} onChange={(e)=>updateTech("screen_other",e.target.value)} placeholder="e.g. 12.4\""/>}</Field>
          <Field label="Hinge style (Optional)"><SelectField value={technicalSpecs.hinge_style} onChange={(v)=>updateTech("hinge_style",v)} options={HINGE_OPTIONS} placeholder="Select"/></Field>
          <Field label="Camera resolution (Optional)"><SelectField value={technicalSpecs.camera_resolution} onChange={(v)=>updateTech("camera_resolution",v)} options={CAMERA_OPTIONS} placeholder="Select"/></Field>
          <Field label="Battery life/status (Optional)"><SelectField value={technicalSpecs.battery_life} onChange={(v)=>updateTech("battery_life",v)} options={BATTERY_OPTIONS} placeholder="Select"/></Field>
        </div><div className="mt-3 flex items-center justify-between rounded-xl border border-border p-3"><div><p className="text-xs font-medium">Dedicated GPU (Optional)</p><p className="text-[10px] text-muted-foreground">{lang === "ar" ? "كرت شاشة منفصل" : "Dedicated graphics"}</p></div><button type="button" role="switch" aria-checked={technicalSpecs.dedicated_gpu} onClick={()=>updateTech("dedicated_gpu",!technicalSpecs.dedicated_gpu)} className={`relative h-6 w-11 rounded-full ${technicalSpecs.dedicated_gpu?"bg-primary":"bg-muted"}`}><span className={`absolute top-1 size-4 rounded-full bg-white ${technicalSpecs.dedicated_gpu?"start-6":"start-1"}`}/></button></div>{technicalSpecs.dedicated_gpu&&<Field label="GPU Model & VRAM (Optional)"><Input value={technicalSpecs.gpu_model_vram} onChange={(e)=>updateTech("gpu_model_vram",e.target.value)} placeholder="NVIDIA RTX 4060 8GB"/></Field>}</div>

        <Field label={t("purpose")}><details className="group relative"><summary className="flex h-11 cursor-pointer list-none items-center justify-between rounded-xl border border-input bg-card px-3 text-sm [&::-webkit-details-marker]:hidden"><span>{draft.purposes.length?`${draft.purposes.length} selected`:"Select purposes"}</span><span>⌄</span></summary><div className="absolute z-20 mt-2 max-h-72 w-full overflow-auto rounded-xl border border-border bg-card p-2 shadow-lg">{PURPOSES.map(p=><label key={p} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-xs hover:bg-muted"><input type="checkbox" checked={draft.purposes.includes(p)} onChange={()=>togglePurpose(p)}/><span>{p}</span></label>)}<label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-xs hover:bg-muted"><input type="checkbox" checked={draft.purposes.includes("Other")} onChange={()=>togglePurpose("Other")}/><span>Other</span></label></div></details>{draft.purposes.length>0&&<p className="text-[11px] text-muted-foreground">Selected: {draft.purposes.join(", ")}</p>}{draft.purposes.includes("Other")&&<Input className="mt-2" placeholder="Write your purpose" value={purposeOther} onChange={(e)=>setPurposeOther(e.target.value)}/>}</Field>
        <Field label={t("brands")}><details className="group relative"><summary className="flex h-11 cursor-pointer list-none items-center justify-between rounded-xl border border-input bg-card px-3 text-sm [&::-webkit-details-marker]:hidden"><span>{draft.brands.length?`${draft.brands.length} selected`:"Select preferred brands"}</span><span>⌄</span></summary><div className="absolute z-20 mt-2 max-h-72 w-full overflow-auto rounded-xl border border-border bg-card p-2 shadow-lg">{brandOptions.map(b=><label key={b} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-xs hover:bg-muted"><input type="checkbox" checked={draft.brands.includes(b)} onChange={()=>toggleBrand(b)}/><span>{b}</span></label>)}<label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-xs hover:bg-muted"><input type="checkbox" checked={brandOther!==""} onChange={()=>setBrandOther(brandOther?"":" ")}/><span>Other</span></label></div></details>{draft.brands.length>0&&<p className="text-[11px] text-muted-foreground">Selected: {draft.brands.join(", ")}</p>}{brandOther!==""&&<Input className="mt-2" placeholder="Write another brand" value={brandOther.trim()} onChange={(e)=>setBrandOther(e.target.value)}/>}</Field>
        <div className="grid grid-cols-2 gap-3"><Field label={t("warranty")}><Input value={draft.warranty_preference??""} onChange={(e)=>setDraft({...draft,warranty_preference:e.target.value})}/></Field><Field label={t("delivery")}><select value={draft.delivery_preference??""} onChange={(e)=>setDraft({...draft,delivery_preference:e.target.value})} className="h-11 w-full rounded-xl border border-input bg-card px-3 text-sm"><option value="">Select delivery preference</option>{DELIVERY_OPTIONS.map(o=><option key={o} value={o}>{o}</option>)}</select></Field></div>
        <Field label={t("notes")}><Textarea rows={2} value={draft.notes??""} onChange={(e)=>setDraft({...draft,notes:e.target.value})}/></Field>
      </Card>
      <div className="flex gap-3"><Button variant="outline" className="flex-1" onClick={()=>setDraft(null)}><Pencil className="size-4"/>{t("edit")}</Button><Button className="flex-1" onClick={confirm} disabled={saving}>{saving?<Spinner/>:<Check className="size-4"/>}{t("confirm")}</Button></div>
    </Page>;
  }

  return <div className="flex min-h-[calc(100vh-9rem)] flex-col"><div className="flex-1 space-y-4 px-4 py-5"><div className="flex items-start gap-2"><span className="grid size-8 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary"><Bot className="size-4"/></span><p className="max-w-[85%] text-sm leading-relaxed">{t("assistantIntro")}</p></div>{messages.map(m=><div key={m.id} className={m.role==="user"?"flex justify-end":"flex items-start gap-2"}>{m.role!=="user"&&<span className="grid size-8 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary"><Bot className="size-4"/></span>}<div className={m.role==="user"?"max-w-[85%] rounded-2xl bg-primary px-3.5 py-2.5 text-sm text-primary-foreground":"max-w-[85%] whitespace-pre-wrap text-sm leading-relaxed text-foreground"}>{textOf(m)}</div>{m.role==="user"&&<span className="ms-2 grid size-8 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground"><User2 className="size-4"/></span>}</div>)}{busy&&<div className="flex items-center gap-2 text-sm text-muted-foreground"><Bot className="size-4 animate-pulse"/>{t("thinking")}</div>}<div ref={endRef}/></div><div className="sticky bottom-20 space-y-3 bg-background/90 px-4 py-3 backdrop-blur">{messages.length>=2&&<Button variant="outline" className="w-full" onClick={review} disabled={reviewing}>{reviewing?<Spinner/>:<Sparkles className="size-4"/>}{t("summarize")}</Button>}<form onSubmit={submit} className="flex items-center gap-2"><Input ref={inputRef} value={input} onChange={(e)=>setInput(e.target.value)} placeholder={t("heroTitle")}/><Button type="submit" size="icon" disabled={busy||!input.trim()} aria-label={t("send")}><Send className="size-4"/></Button></form></div></div>;
}
