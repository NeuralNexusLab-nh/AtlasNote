import {t,localized as L} from './i18n.js';
const icon=n=>`<i class="fa-solid fa-${n}" aria-hidden="true"></i>`;
const P=a=>`<p>${L(a)}</p>`;
const card=(i,h,p)=>`<article class="card detail-card"><h3>${icon(i)}<span>${L(h)}</span></h3>${P(p)}</article>`;
export function homeDetails(signedIn=false){return `
<section class="home-detail home-purpose" id="about"><header class="detail-heading"><p class="eyebrow">${icon('bolt')}${L(['SMALL NOTES. EVERYDAY SHORTCUTS.','小筆記，派上大用場','小さなメモが、毎日の近道に'])}</p><h2>${L(['Keep the text. Skip the hunt.','下次要用，不必再翻一次。','次に使うときは、探し回らない。'])}</h2>${P(['AtlasNote is a free online notebook for text and images. Find your notes across devices, choose encryption, and get a hand from Atlas Agent.','AtlasNote 是能保存文字與圖片的免費線上筆記本。跨裝置取用、加密私密內容，也有 Atlas Agent 幫忙整理。','AtlasNote は文章と画像の無料オンラインノート。端末をまたいで取り出し、暗号化を選び、Atlas Agent で整えられます。'])}</header><div class="feature-grid">${[
 ['note-sticky',['Write it down','好好記下來','書き留める'],['Notes, lists and study points. Keep text and images together.','筆記、清單與學習重點，文字和圖片一起保存。','ノート、リスト、学習の要点。文章と画像をひとまとめに。']],
 ['magnifying-glass',['Retrieve it in seconds','需要時立刻拿到','すぐ取り出す'],['Switch devices. Search, copy and use your notes.','換個裝置，搜尋、複製後就能使用。','別の端末でも、検索してコピー。すぐ使えます。']],
 ['shield-halved',['Protect sensitive information','私密內容，好好保護','私的な情報を守る'],['Choose encryption for the content you want to keep private.','選擇加密方式，私密內容另加一道鎖。','個人的な内容には、自分で選ぶ暗号化を。']],
 ['wand-magic-sparkles',['Do more with one note','讓筆記更好用','ノートを整える'],['Refine text or mark images with Atlas Agent. Preview, then save.','整理文字、標記圖片，預覽後再儲存。','Atlas Agent で文章や画像を整え、確認して保存。']]
 ].map(a=>card(...a)).join('')}</div></section>
<section class="home-detail home-organize"><header class="detail-heading"><p class="eyebrow">${icon('layer-group')}${L(['ORGANIZE & RECOVER','整理與復原','整理と復元'])}</p><h2>${L(['Keep favorites close. Leave a way back.','常用的在前面，改錯了有退路。','よく使うものは先頭に。間違えても戻れるように。'])}</h2></header><div class="use-case-grid">${[
 ['thumbtack',['Keep your go-to notes first','常用筆記，釘在前面','よく使うノートを先頭に'],['Pin what you reach for, archive what can wait, or organize several notes at once.','釘選常用筆記、封存暫時用不到的內容，也能一次整理多篇。','よく使うノートはピン留め、後で使うものはアーカイブ。まとめて操作もできます。']],
 ['clock-rotate-left',['Return to earlier text','改錯文字，回到先前版本','以前の文章に戻る'],['Preview saved text versions before restoring. Choose how many to keep in Settings.','還原前先預覽文字版本，保留幾個版本可在設定調整。','保存した文章履歴を確認してから復元。件数は設定で選べます。']],
 ['trash-can-arrow-up',['Recover an accidental deletion','誤刪筆記，從垃圾桶找回','誤って消したノートを復元'],['Restore a note while it is still in the trash. Set the retention time that suits you.','在保留期限內，從垃圾桶還原筆記。保留多久，由你設定。','保存期間内ならゴミ箱から復元。期間も自分で設定できます。']]
 ].map(a=>card(...a)).join('')}</div></section>
<section class="home-detail" id="encryption"><header class="detail-heading"><p class="eyebrow">${icon('shield-halved')}${t('encryption')}</p><h2>${L(['Private notes deserve a choice.','私密內容，選擇自己的加密。','個人的なノートに、暗号化の選択を。'])}</h2>${P(['Use basic encryption for everyday notes, or AtlasEncrypt when you want content to need a secret only you keep.','日常筆記可用基本加密；更私密的內容，交給 AtlasEncrypt，以自己保管的密語解鎖。','日常のノートには基本暗号化。より私的な内容には、自分で保管するパスフレーズで開く AtlasEncrypt。'])}</header><div class="use-case-grid encryption-overview">${[
 ['file-lines',[t('none'),t('none'),t('none')],['Store content without encryption.','直接儲存，不加密內容。','内容を暗号化せず保存。']],
 ['lock',[t('basic'),t('basic'),t('basic')],['Encrypted in storage. Sign in to open it.','加密儲存，登入後即可開啟。','暗号化して保存し、ログインして開きます。']],
 ['fingerprint',['AtlasEncrypt','AtlasEncrypt','AtlasEncrypt'],['Encrypt before upload. Your secret stays on your device.','上傳前加密，密語不傳到雲端。','送信前に暗号化。パスフレーズはクラウドに送りません。']]
 ].map(a=>card(...a)).join('')}</div><p class="section-link"><a href="/docs.html?article=encryption">${t('guideEncrypt')}${icon('arrow-right')}</a></p></section>
<section class="card home-final"><img src="/asset/logo.svg" alt="" width="42" height="42"><h2>${L(['Keep your next useful note here.','下一篇用得上的筆記，就放這裡。','次に役立つノートを、ここに。'])}</h2><div class="actions"><a class="button primary" href="/dashboard.html" data-home-primary>${icon(signedIn?'table-columns':'right-to-bracket')}<span>${t(signedIn?'openDashboard':'homeStart')}</span></a><a class="button" href="/docs.html">${icon('book')}${t('docs')}</a></div></section>`;}
