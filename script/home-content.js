import {t,localized as L} from './i18n.js';
const icon=n=>`<i class="fa-solid fa-${n}" aria-hidden="true"></i>`;
const P=a=>`<p>${L(a)}</p>`;
const H=a=>L(a).split(/(?<=[，。])/u).filter(Boolean).map(phrase=>`<span>${phrase}</span>`).join('');
const card=(i,h,p)=>`<article class="card detail-card"><h3>${icon(i)}<span>${L(h)}</span></h3>${P(p)}</article>`;
export function homeDetails(signedIn=false){return `
<section class="home-detail home-purpose" id="about"><header class="detail-heading"><p class="eyebrow">${icon('bolt')}${L(['SMALL NOTES. EVERYDAY SHORTCUTS.','小筆記，派上大用場','小さなメモが、毎日の近道に'])}</p><h2>${H(['Keep the text. Skip the hunt.','下次要用，不必再翻一次。','次に使うときは、探し回らない。'])}</h2>${P(['AtlasNote is a free online notebook for text and images. Find your notes across devices, choose encryption, and get a hand from Atlas Agent.','AtlasNote 是能保存文字與圖片的免費線上筆記本。跨裝置取用、加密私密內容，也有 Atlas Agent 幫忙整理。','AtlasNote は文章と画像の無料オンラインノート。端末をまたいで取り出し、暗号化を選び、Atlas Agent で整えられます。'])}</header><div class="feature-grid">${[
 ['note-sticky',['Write it down','好好記下來','書き留める'],['Notes, lists and study points. Keep text and images together.','筆記、清單與學習重點，文字和圖片一起保存。','ノート、リスト、学習の要点。文章と画像をひとまとめに。']],
 ['magnifying-glass',['Retrieve it in seconds','需要時立刻拿到','すぐ取り出す'],['Switch devices. Search, copy and use your notes.','換個裝置，搜尋、複製後就能使用。','別の端末でも、検索してコピー。すぐ使えます。']],
 ['shield-halved',['Protect sensitive information','私密內容，好好保護','私的な情報を守る'],['Choose encryption for the content you want to keep private.','選擇加密方式，私密內容另加一道鎖。','個人的な内容には、自分で選ぶ暗号化を。']],
 ['wand-magic-sparkles',['Atlas Agent, your AI editor','Atlas Agent，AI 幫你改。','Atlas Agent で AI 編集'],['Refine text or mark images with AI. Preview changes before saving.','用 AI 整理文字、標記圖片，先看預覽再儲存。','AI で文章や画像を整え、変更を確認してから保存。']]
 ].map(a=>card(...a)).join('')}</div></section>
<section class="home-detail home-organize"><header class="detail-heading"><p class="eyebrow">${icon('layer-group')}${L(['ORGANIZE & RECOVER','整理與復原','整理と復元'])}</p><h2>${H(['Keep favorites close. Leave a way back.','常用的在前面，改錯了有退路。','よく使うものは先頭に。間違えても戻れるように。'])}</h2></header><div class="card organize-list">${[
 ['thumbtack',['Keep favorites first','常用筆記，釘在前面','よく使うノートを先頭に'],['Pin, archive or organize several notes at once.','釘選、封存，也能一次整理多篇筆記。','ピン留め、アーカイブ、まとめて整理。']],
 ['clock-rotate-left',['Find an earlier version','改錯文字，有版本可回去','以前の文章に戻る'],['Preview earlier text before restoring.','先預覽先前的文字，確認後再還原。','以前の文章を確認してから復元。']],
 ['trash-can-arrow-up',['Bring a deleted note back','不小心刪了，還能找回','誤って消しても、取り戻せる'],['Restore from the trash within your chosen retention time.','在設定的保留期限內，從垃圾桶還原。','設定した保存期間内なら、ゴミ箱から復元。']]
 ].map(([i,h,p])=>`<article class="organize-item">${icon(i)}<div><h3>${L(h)}</h3>${P(p)}</div></article>`).join('')}</div></section>
<section class="home-detail home-encryption" id="encryption"><header class="detail-heading"><p class="eyebrow">${icon('shield-halved')}${t('encryption')}</p><h2>${H(['Private notes deserve a choice.','私密內容，選擇自己的加密。','個人的なノートに、暗号化の選択を。'])}</h2>${P(['Everyday encryption, or a passphrase only you keep. Choose what suits each note.','日常加密，或用自己保管的密語解鎖。每篇筆記，自己選擇。','日常の暗号化から、自分だけのパスフレーズまで。ノートごとに選べます。'])}</header><div class="card encryption-overview">${[
 ['file-lines',[t('none'),t('none'),t('none')],['Store content without encryption.','直接儲存，不加密內容。','内容を暗号化せず保存。']],
 ['lock',[t('basic'),t('basic'),t('basic')],['Encrypted in storage. Sign in to open it.','加密儲存，登入後即可開啟。','暗号化して保存し、ログインして開きます。']],
 ['fingerprint',['AtlasEncrypt','AtlasEncrypt','AtlasEncrypt'],['Encrypt before upload. Your secret stays on your device.','上傳前加密，密語不傳到雲端。','送信前に暗号化。パスフレーズはクラウドに送りません。']]
 ].map(([i,h,p],index)=>`<article class="encryption-option${index===2?' encryption-private':''}"><h3>${icon(i)}<span>${L(h)}</span></h3>${P(p)}</article>`).join('')}</div><p class="section-link"><a href="/docs.html?article=encryption">${t('guideEncrypt')}${icon('arrow-right')}</a></p></section>
<section class="card home-final"><img src="/asset/logo.svg" alt="" width="42" height="42"><h2>${L(['Keep your next useful note here.','下一篇用得上的筆記，就放這裡。','次に役立つノートを、ここに。'])}</h2><div class="actions"><a class="button primary" href="/dashboard.html" data-home-primary>${icon(signedIn?'table-columns':'right-to-bracket')}<span>${t(signedIn?'openDashboard':'homeStart')}</span></a><a class="button" href="/docs.html">${icon('book')}${t('docs')}</a></div></section>`;}
