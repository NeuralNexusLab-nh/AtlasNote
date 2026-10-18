import {t,localized as L} from './i18n.js';
const titles=['gettingStarted','guideNotes','guideEncrypt','guideBackup','guideOffline','guideFAQ'];
export const docKeys=['start','notes','encryption','backup','offline','faq'];
const P=values=>`<p>${L(values)}</p>`;
const box=(title,text)=>`<section class="card guide-card"><h3>${title}</h3>${text}</section>`;
const steps=items=>`<div class="quick-steps">${items.map(([h,p],i)=>`<div class="quick-step"><span>${i+1}</span><div><strong>${L(h)}</strong><p>${L(p)}</p></div></div>`).join('')}</div>`;
export function docsContent(key){
  if(key==='notes')return {title:t('guideNotes'),lead:L(['Everything you need to write, find and organize.','寫下來，找得到，也整理得好。','書いて、見つけて、整理する。']),html:
    box(t('writing'),P(['Choose New note, add a title, and start writing. Markdown turns headings, lists and links into a clean reading view. Use Copy content when you want to take just the text.','點「新增筆記」，輸入標題就能開始。Markdown 可讓標題、清單與連結顯示得更清楚；需要帶走文字時，按「複製內容」。','「新しいノート」からタイトルを付けて書き始めます。Markdown で見出しやリストを整え、本文だけをコピーすることもできます。']))+
    box(t('images'),steps([
      [['Add an image','放進圖片','画像を追加'],['Choose, paste or drop up to three PNG, JPEG or WebP images.','每篇可選取、貼上或拖放三張 PNG、JPEG 或 WebP。','PNG・JPEG・WebP を選択、貼り付け、ドロップで 3 枚まで追加できます。']],
      [['Make it yours','加上你的重點','大切なところを加える'],['Add a caption, draw, erase or place text on the image.','可寫註解，也能用畫筆、橡皮擦或文字標記重點。','説明を書き、ペンや消しゴム、文字で編集できます。']],
      [['Put it in the right place','放在需要的位置','好きな場所に配置'],['Use Insert in text to position it within your note. Otherwise it appears below.','按圖片的「插入內文」，就能放到文字之間；沒有插入的會顯示在下方。','「本文に挿入」で文章の間に配置できます。それ以外は本文の下に表示します。']]
    ]))+
    box(t('compression'),P(['Compact makes the smallest files; Balanced keeps text readable with moderate file sizes; Clear prioritizes original detail. Switching updates images already in the editor. The uploaded original is kept only during this edit: previously saved compression cannot be undone after reopening.','精簡優先縮小檔案，適中兼顧清楚與大小，清晰盡量保留原圖細節。切換會更新目前圖片。上傳原圖只在這次編輯暫存，已儲存後失去的細節，重新開啟也無法還原。','コンパクトは容量優先、バランスは読みやすさと容量を両立、鮮明は元画像の細部を優先します。切り替えは編集中の画像に適用されます。元画像は今回の編集中だけ保持され、保存後に失われた細部は復元できません。']))+
    box(t('organized'),P(['Pinned notes stay at the top. Archive notes to put them aside without deleting them. Use search and filters to find them again, or select several notes for batch actions.','釘選會排在最上面；暫時用不到的可以封存，不必刪除。透過標題搜尋與篩選找回筆記，也能一次勾選多篇操作。','ピン留めは先頭に表示。今使わないものは削除せずアーカイブできます。検索・絞り込み・一括操作も使えます。']))+
    box(t('history'),P(['Settings lets you keep up to 20 previous text versions. Open Text history on a note to preview and restore one. Restoring changes the title and text only; your current images stay.','可在設定選擇保留 0、1、3、5、10 或 20 個文字版本。筆記內按「文字版本」即可預覽與還原。還原只改標題與文字，不會換掉目前圖片。','設定で 0・1・3・5・10・20 件の文章履歴を選べます。ノートの履歴から確認・復元できます。画像は現在のまま残ります。']))+
    box(t('trash'),P(['Deleted notes go to Trash first. You can restore them before their deadline, or delete them permanently. Choose how long to keep them in Settings.','刪除會先移到垃圾桶，期限內可以還原，也能立即永久刪除。保留多久，可在設定調整。','削除したノートはまずゴミ箱へ。期限内なら復元でき、すぐに完全削除することもできます。保存期間は設定で変更できます。']))};
  if(key==='encryption')return {title:t('guideEncrypt'),lead:L(['Choose the level that suits this note.','依照這篇筆記的需要，選擇加密方式。','ノートに合う暗号化を選びましょう。']),html:
    box(t('none'),P(['Open and read immediately. A good fit for everyday notes that do not need encryption.','打開就能看，適合不需要加密的日常記錄。','すぐに開いて読めます。暗号化が不要な日常のメモに。']))+
    box(t('basic'),P(['Encrypts your notes automatically, without asking for a passphrase. The key is saved on this device, so you can keep opening notes easily. Someone who obtains both your device key and note data can still read them.','自動加密，不必每次輸入密語，平常打開一樣方便。金鑰保存在此裝置；若金鑰與筆記一起被取得，內容仍可能被讀取。','パスフレーズなしで自動暗号化し、普段どおり開けます。鍵は端末に保存されるため、鍵とノートを両方取得されると読まれる可能性があります。']))+
    box('AtlasEncrypt',P(['The secure option. Set a passphrase when you create the note, then enter it to unlock the content. The app does not save your passphrase or provide a way to recover it.','也就是「安全加密」。建立時設定密語，之後輸入密語才能解鎖內容。程式不會保存你的密語，也無法代為找回。','「安全な暗号化」です。作成時にパスフレーズを設定し、内容を開くときに入力します。パスフレーズは保存されず、復旧もできません。'])+
      P(['Use 4–16 ASCII characters: letters, numbers and symbols. A longer, random passphrase is safer than a short, predictable one.','密語可用 4–16 個 ASCII 字元，也就是英文字母、數字與半形符號。越長、越隨機，越不容易被猜中。','英字・数字・半角記号の ASCII 4〜16 文字を使えます。長くランダムなものほど推測されにくくなります。']))+
    '<div class="notice">'+P(['Encrypted titles remain visible and searchable in your note list. Only unlock on a device you trust.','加密筆記的標題仍可在清單顯示與搜尋。請只在信任的裝置上解鎖。','暗号化したノートも一覧ではタイトルを表示・検索できます。信頼できる端末でだけ開いてください。'])+'</div>'};
  if(key==='backup')return {title:t('guideBackup'),lead:L(['Move a note to another device, or keep a spare copy.','換一台裝置，或替重要筆記留一份副本。','別の端末へ移すとき、大切なコピーを残すとき。']),html:
    box(t('export'),steps([
      [['Open the note','打開筆記','ノートを開く'],['Choose Export JSON from the note’s actions.','在筆記操作列按「匯出 JSON」。','ノートの操作から「JSON を書き出す」を選びます。']],
      [['Save the file','保存檔案','ファイルを保存'],['Each file contains one note, its current images and text versions.','每個檔案只包含一篇筆記、目前圖片與文字版本。','1 ファイルに 1 件のノート、現在の画像、文章履歴が入ります。']]
    ]))+
    box(t('import'),P(['In Settings, choose Import JSON and select the file. AtlasNote adds a new note without overwriting anything. AtlasEncrypt asks for the original passphrase, then lets you set one for the imported copy. There is no fixed import file-size limit; available device memory and storage determine whether a file can be imported.','在設定按「匯入 JSON」並選擇檔案，就會建立新筆記，不覆蓋既有內容。AtlasEncrypt 需要原密語，再為匯入後的副本設定密語。匯入檔案不設固定大小上限，能否完成取決於裝置的記憶體與可用空間。','設定の「JSON を読み込む」で、新しいノートとして追加します。既存ノートは上書きしません。AtlasEncrypt では元のパスフレーズと、新しいコピー用のパスフレーズを入力します。ファイルサイズの固定上限はありません。読み込みの可否は端末のメモリーと空き容量によります。']))+
    '<div class="notice">'+P(['Keep exported files private. Anyone with a basic-encryption export can read that note. AtlasEncrypt exports still require the passphrase.','請妥善保管匯出檔。基本加密的匯出檔可直接還原內容；AtlasEncrypt 的匯出檔仍需密語。','書き出したファイルは安全に保管してください。基本暗号化のファイルはそのまま復元できます。AtlasEncrypt のファイルはパスフレーズが必要です。'])+'</div>'};
  if(key==='offline')return {title:t('guideOffline'),lead:L(['Keep writing, even without a connection.','沒網路，也能接著寫。','接続がなくても、続きを。']),html:
    box(t('install'),P(['Choose Install AtlasNote at the top of the site. If your browser offers an install button, follow it. On iPhone or iPad, open in Safari, tap Share, then Add to Home Screen.','點網站上方的「安裝 AtlasNote」，依照瀏覽器提示完成。iPhone、iPad 請用 Safari，點「分享」再選「加入主畫面」。','サイト上部の「AtlasNote をインストール」を選びます。iPhone・iPad は Safari で「共有」→「ホーム画面に追加」を使ってください。']))+
    box(L(['Before going offline','離線之前','オフラインにする前に']),P(['Open AtlasNote online once and let it finish loading. After that, you can open, edit and save notes offline. Installing is optional.','先連線開啟一次，等畫面載入完成。之後就能離線開啟、編輯與儲存筆記，不一定要先安裝。','一度オンラインで開き、読み込みを完了してください。その後はオフラインでも開く・編集・保存できます。インストールは必須ではありません。']))+
    '<div class="notice">'+P(['Your notes stay in the browser you used. Another browser or device has a separate notebook; installation does not turn on syncing.','筆記保存在目前使用的瀏覽器。換瀏覽器或裝置，不會自動出現同一份筆記；安裝也不會開啟同步。','ノートは使っているブラウザーに保存されます。別のブラウザーや端末には自動で移りません。インストールしても同期はしません。'])+'</div>'};
  if(key==='faq')return {title:t('guideFAQ'),lead:L(['Answers for everyday use.','使用時，你可能想知道的事。','使うときに知っておきたいこと。']),html:[
    [['Where are my notes?','我的筆記在哪裡？','ノートはどこにありますか？'],['In this browser, on this device. AtlasNote does not upload your notes.','在這台裝置、這個瀏覽器裡。AtlasNote 不會上傳你的筆記。','この端末の、このブラウザーにあります。ノートはアップロードしません。']],
    [['How much can I store?','可以存多少？','どれくらい保存できますか？'],['Settings shows the space your browser estimates is available. It depends on the device and may change.','設定會顯示瀏覽器估計可使用的空間，依裝置而異，也可能變動。','設定にブラウザーが見積もる使用可能な容量を表示します。端末によって異なり、変わる場合もあります。']],
    [['What should I avoid deleting?','有什麼不能亂刪？','消してはいけないものは？'],['Do not clear AtlasNote site data or edit its localStorage entries. They contain your notes’ keys. Clearing browser data can make notes disappear or become unreadable.','不要清除 AtlasNote 網站資料，也不要手動修改 localStorage，裡面有筆記需要的金鑰。清除瀏覽器資料可能讓筆記消失或無法開啟。','AtlasNote のサイトデータや localStorage を削除・編集しないでください。ノートの鍵が含まれます。消去するとノートを失ったり、開けなくなることがあります。']],
    [['I forgot an AtlasEncrypt passphrase.','忘記 AtlasEncrypt 密語怎麼辦？','AtlasEncrypt のパスフレーズを忘れました。'],['There is no recovery option. Keep the encrypted note in case you remember it later.','無法代為找回，請保留加密筆記，日後想起密語時還能開啟。','復旧はできません。思い出したときのために暗号化したノートを残してください。']],
    [['Can I use private browsing?','可以用無痕模式嗎？','プライベートブラウズでも使えますか？'],['It is not recommended for keeping notes. Closing the private session may delete the data.','不建議用來保存筆記，關閉無痕視窗可能會刪除資料。','保存にはおすすめしません。終了時にデータが消えることがあります。']]
  ].map(([q,a])=>`<details><summary>${L(q)}</summary><p>${L(a)}</p></details>`).join('')+box(t('contact'),'<a class="button" href="mailto:atlasnote@nxlabtw.com"><i class="fa-solid fa-envelope" aria-hidden="true"></i>atlasnote@nxlabtw.com</a>')};
  return {title:t('guideIntro'),lead:L(['A place for your words, images and everyday ideas. No sign-up. Open it and start.','文字、圖片與生活裡的想法，都能放在這裡。不必註冊，打開就能開始。','文章も画像も、日々のアイデアも。登録せずに、開いてすぐ始められます。']),html:
    steps([
      [['Create your first note','寫第一篇筆記','最初のノートを書く'],['Choose New note, give it a title, and write what you want to remember.','點「新增筆記」，取個標題，寫下想記住的事。','「新しいノート」でタイトルを付け、覚えておきたいことを書きます。']],
      [['Add an image or choose encryption','放張圖片，或選擇加密','画像や暗号化を使う'],['Add up to three images. For private content, choose AtlasEncrypt and set your passphrase.','每篇可放三張圖片。私密內容可選 AtlasEncrypt，再設定自己的密語。','画像を 3 枚まで追加できます。私的な内容には AtlasEncrypt とパスフレーズを。']],
      [['Save and come back anytime','儲存，下次再接著寫','保存して、また続きを'],['Your note appears in My notes. Pin it or search its title when you need it.','儲存後就在「我的筆記」。常用的釘起來，需要時也能搜尋標題。','保存するとノート一覧に表示されます。ピン留めやタイトル検索で見つけられます。']]
    ])+'<div class="notice">'+P(['Notes stay on this device. Do not clear the site’s data if you want to keep them.','筆記保存在這台裝置，想保留內容，就不要清除網站資料。','ノートはこの端末に保存されます。残したいときはサイトデータを消去しないでください。'])+'</div>'};
}
export {policy} from './policies.js';
export const docTitle=k=>t(titles[docKeys.indexOf(k)]||'gettingStarted');
