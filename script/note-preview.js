import {t} from './i18n.js';

// Shared by Agent review and text history. Treat every supplied title as text.
export function notePreview({title,text,images=[]},renderProse,{contentId}={}){
  const preview=document.createElement('div');preview.className='note-preview';
  for(const [kind,glyph] of [['title','heading'],['content','align-left']]){
    const section=document.createElement('section'),heading=document.createElement('h3');
    heading.id='preview-'+crypto.randomUUID();heading.className='note-preview-label';
    const icon=document.createElement('i');icon.className='fa-solid fa-'+glyph;icon.setAttribute('aria-hidden','true');
    heading.append(icon,document.createTextNode(t(kind)));section.setAttribute('aria-labelledby',heading.id);section.append(heading);
    if(kind==='title'){
      const value=document.createElement('p');value.className='note-preview-title';value.textContent=title;section.append(value);
    }else{
      const value=document.createElement('div');value.className='note-preview-content';if(contentId)value.id=contentId;
      if(text||images.length)value.append(renderProse(text,images));
      else{const empty=document.createElement('p');empty.className='muted';empty.textContent=t('previewEmpty');value.append(empty);}
      section.append(value);
    }
    preview.append(section);
  }
  return preview;
}
