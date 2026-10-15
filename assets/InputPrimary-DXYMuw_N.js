import{q as k,j as e,f as y}from"./data-sboWvH_Z.js";import{r as w}from"./vendor-Dvv9S-nA.js";import{P as i}from"./index-DETM_FIh.js";const N=({name:l,as:d="input",type:s="text",placeholder:f,disabled:g,customFile:v=!1,className:b,value:n,onChange:h,error:p=!0,...u})=>{const[a,m]=w.useState(null);let x=null;try{const r=k();r&&typeof r=="object"&&"values"in r&&(x=r)}catch{x=null}const F=x&&l&&!n&&!h;w.useEffect(()=>{s==="file"&&n&&typeof n=="string"&&m(n)},[n,s]);const j=(r,o)=>{const t=r.currentTarget.files[0];if(t){o&&o.setFieldValue(l,t);const c=new FileReader;c.onloadend=()=>{m(c.result)},c.readAsDataURL(t)}};return F?s==="file"&&v?e.jsx(y,{name:l,...u,children:({form:r,meta:o})=>e.jsxs(e.Fragment,{children:[e.jsx("div",{onClick:()=>document.getElementById(`hidden-file-${l}`).click(),className:`
                cursor-pointer w-full p-4
                bg-signalWhite text-black
                rounded-lg border border-borderInput
                hover:opacity-90 transition-all
                focus:outline-none focus:ring-2 focus:ring-primary
                disabled:cursor-not-allowed disabled:opacity-50
              `,children:f}),e.jsx("input",{id:`hidden-file-${l}`,type:"file",style:{display:"none"},onChange:t=>j(t,r),disabled:g,accept:"image/*"}),a&&e.jsx("img",{src:a,alt:"Vista previa",className:"w-14 h-14 object-cover rounded-lg"}),o.touched&&o.error&&p&&e.jsx("p",{className:"text-error text-sm mt-1",children:o.error})]})}):e.jsx(y,{name:l,...u,children:({field:r,form:o,meta:t})=>e.jsxs(e.Fragment,{children:[e.jsx(d,{...r,value:s==="file"?"":r.value??"",...d==="input"&&{type:s},disabled:g,placeholder:f,className:`
              w-full p-4
              bg-signalWhite text-black
              rounded-lg border border-borderInput
              hover:opacity-90 transition-all
              focus:outline-none focus:ring-2 focus:ring-primary
              disabled:cursor-not-allowed disabled:opacity-50
              ${d==="textarea"?"resize-none":""}
              ${b}
            `,onChange:c=>{s==="file"?j(c,o):r.onChange(c)},...u}),s==="file"&&a&&e.jsx("img",{src:a,alt:"Vista previa",className:"w-14 h-14 object-cover rounded-lg"}),t.touched&&t.error&&p&&e.jsx("p",{className:"text-error text-sm mt-1",children:t.error})]})}):e.jsxs(e.Fragment,{children:[e.jsx(d,{name:l,value:n||"",onChange:h,type:s,disabled:g,placeholder:f,className:`
            w-full p-4
            bg-signalWhite text-black
            rounded-lg border border-borderInput
            hover:opacity-90 transition-all
            focus:outline-none focus:ring-2 focus:ring-primary
            disabled:cursor-not-allowed disabled:opacity-50
            ${d==="textarea"?"resize-none":""}
            ${b}
          `,...u}),s==="file"&&a&&e.jsx("img",{src:a,alt:"Vista previa",className:"w-14 h-14 object-cover rounded-lg"})]})};N.propTypes={name:i.string,as:i.elementType,type:i.string,placeholder:i.string,disabled:i.bool,customFile:i.bool,value:i.oneOfType([i.string,i.number]),onChange:i.func};export{N as I};
