<?php
declare(strict_types=1);

namespace PD;

/** The noir evidence upload page, ported from packages/server/src/uploadPage.ts. */
final class Pages
{
    public static function upload(string $lang): string
    {
        $t = $lang === 'en'
            ? ['title' => 'Hand over the evidence', 'lead' => 'Drag screens, photos and sketches here. PNG, JPG, GIF or WebP, up to 20 MB each.', 'pick' => 'Choose files', 'done' => 'Evidence logged', 'failed' => "That didn't work", 'back' => "When you're done, go back to the chat and say you've handed it over.", 'stamp' => 'CONFIDENTIAL']
            : ['title' => 'Entregue as provas', 'lead' => 'Arraste telas, fotos e rascunhos pra cá. PNG, JPG, GIF ou WebP, até 20 MB cada.', 'pick' => 'Escolher arquivos', 'done' => 'Prova registrada', 'failed' => 'Não deu certo', 'back' => 'Quando terminar, volte pra conversa e diga que entregou.', 'stamp' => 'CONFIDENCIAL'];
        $t = array_map(fn($s) => htmlspecialchars($s, ENT_QUOTES), $t);
        $name = htmlspecialchars(Core::name($lang), ENT_QUOTES);
        $js = Json::encode(['done' => html_entity_decode($t['done'], ENT_QUOTES), 'failed' => html_entity_decode($t['failed'], ENT_QUOTES)]);
        return <<<HTML
<!doctype html><html lang="$lang"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{$t['title']} · Portfolio Detective</title>
<style>
:root{--ink:#111;--paper:#ECE7DE;--manila:#D9C29A;--manila-dark:#B89E72;--stamp:#8E3B2F}
*{box-sizing:border-box}body{margin:0;min-height:100vh;background:#1b1b1b;color:#eee;font-family:"Courier New",Courier,monospace;
background-image:repeating-linear-gradient(180deg,rgba(255,255,255,.05) 0 18px,transparent 18px 46px);display:grid;place-items:center;padding:16px}
.folder{width:min(640px,100%);background:var(--manila);color:var(--ink);border-radius:4px 14px 6px 6px;padding:28px;position:relative;box-shadow:0 30px 60px rgba(0,0,0,.6)}
.folder::before{content:"";position:absolute;top:-22px;left:0;width:190px;height:24px;background:var(--manila);border-radius:10px 10px 0 0}
.who{font-size:14px;letter-spacing:.15em;text-transform:uppercase}h1{font-family:Georgia,serif;font-size:32px;margin:6px 0 12px}p{line-height:1.5}
.drop{border:2px dashed var(--manila-dark);background:var(--paper);padding:36px 16px;text-align:center;border-radius:6px;margin:18px 0}.drop.over{border-color:var(--ink)}
label.btn{display:inline-block;margin-top:12px;background:var(--ink);color:var(--paper);padding:12px 20px;cursor:pointer}
label.btn:focus-within{outline:3px solid var(--stamp);outline-offset:3px}input[type=file]{position:absolute;opacity:0;width:1px;height:1px}
ul{list-style:none;padding:0;margin:0}li{padding:8px 0;border-bottom:1px solid var(--manila-dark)}.ok{color:#2f5d2f}.err{color:var(--stamp)}
.stamp{position:absolute;right:18px;top:18px;border:3px solid var(--stamp);color:var(--stamp);padding:2px 8px;transform:rotate(8deg);font-weight:700;letter-spacing:.1em}
</style></head><body>
<main class="folder"><span class="stamp" aria-hidden="true">{$t['stamp']}</span><div class="who">$name</div><h1>{$t['title']}</h1><p>{$t['lead']}</p>
<div class="drop" id="drop"><p aria-hidden="true">▣ ▣ ▣</p><label class="btn">{$t['pick']}<input id="f" type="file" accept="image/png,image/jpeg,image/gif,image/webp" multiple></label></div>
<ul id="list" aria-live="polite"></ul><p>{$t['back']}</p></main>
<script>
const T=$js,list=document.getElementById("list"),drop=document.getElementById("drop");
async function send(file){const li=document.createElement("li");li.textContent=file.name+" …";list.appendChild(li);
try{const r=await fetch(location.pathname,{method:"POST",headers:{"content-type":"application/octet-stream","x-filename":encodeURIComponent(file.name)},body:file});
const j=await r.json();if(!r.ok)throw new Error(j.error||r.status);li.textContent=T.done+": "+file.name+" (id: "+j.id+")";li.className="ok"}
catch(e){li.textContent=T.failed+": "+file.name+" ("+e.message+")";li.className="err"}}
document.getElementById("f").addEventListener("change",e=>[...e.target.files].forEach(send));
drop.addEventListener("dragover",e=>{e.preventDefault();drop.classList.add("over")});drop.addEventListener("dragleave",()=>drop.classList.remove("over"));
drop.addEventListener("drop",e=>{e.preventDefault();drop.classList.remove("over");[...e.dataTransfer.files].forEach(send)});
</script></body></html>
HTML;
    }

    /** Reads width and height from PNG, JPEG, GIF or WebP. */
    public static function imageInfo(string $data): ?array
    {
        $info = @getimagesizefromstring($data);
        if (!$info) {
            return null;
        }
        $types = [IMAGETYPE_PNG => ['image/png', 'png'], IMAGETYPE_JPEG => ['image/jpeg', 'jpg'], IMAGETYPE_GIF => ['image/gif', 'gif'], IMAGETYPE_WEBP => ['image/webp', 'webp']];
        if (!isset($types[$info[2]])) {
            return null;
        }
        return ['mime' => $types[$info[2]][0], 'ext' => $types[$info[2]][1], 'width' => $info[0], 'height' => $info[1]];
    }
}
