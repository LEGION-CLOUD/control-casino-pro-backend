import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const API = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_URL) ? import.meta.env.VITE_API_URL : 'http://localhost:3001/api';
const C = { bg:'#08080F', sidebar:'#0F0F1E', card:'#12121F', border:'#252542', purple:'#8B5CF6', purpleDark:'#6D28D9', gold:'#D4AF37', goldDark:'#9C7C1C', text:'#E9E9F5', textMut:'#8B8BA7', green:'#10B981', red:'#EF4444' };

function generarComprobantePDF(op, clienteObj){
  const doc = new jsPDF();
  doc.setFillColor(8,8,15); doc.rect(0,0,210,297,'F');
  doc.setFillColor(212,175,55); doc.rect(0,0,210,24,'F');
  doc.setTextColor(0,0,0); doc.setFont('helvetica','bold'); doc.setFontSize(16); doc.text('CASINO CONTROL PRO', 12, 15);
  doc.setFontSize(9); doc.setFont('helvetica','normal'); doc.text('Comprobante Oficial - Negro • Lila • Dorado', 115, 15);
  doc.setDrawColor(212,175,55); doc.setLineWidth(0.7); doc.rect(10,30,190,92);
  doc.setTextColor(233,233,245); doc.setFontSize(17); doc.setFont('helvetica','bold');
  doc.text(op.tipo==='ingreso' ? 'COMPROBANTE DE CARGA' : 'COMPROBANTE DE RETIRO / EGRESO', 12, 42);
  doc.setFontSize(11); doc.setTextColor(139,92,246); doc.text(`Operación #${op.id} - ${new Date(op.fecha).toLocaleString()}`, 12, 49);
  doc.setTextColor(233,233,245); doc.setFontSize(11); doc.setFont('helvetica','normal');
  doc.text(`Cliente: ${op.cliente_nombre || (clienteObj ? clienteObj.nombre+' '+(clienteObj.apellido||'') : '')}`, 12, 59);
  doc.text(`DNI: ${clienteObj?.dni || '-'} | Tel: ${clienteObj?.telefono || '-'}`, 12, 65);
  doc.text(`Cajero: ${op.cajero || op.cajero_nombre || '-'}`, 12, 71);
  doc.text(`Método: ${(op.metodo_pago||'efectivo').toUpperCase()}`, 12, 77);
  if(op.referencia) doc.text(`Referencia / ID Trans: ${op.referencia}`, 12, 83);
  doc.text(`Concepto: ${op.concepto||'-'}`, 12, 89);
  doc.setFillColor(18,18,31); doc.rect(124,54,74,42,'F');
  doc.setDrawColor(212,175,55); doc.rect(124,54,74,42);
  doc.setTextColor(212,175,55); doc.setFontSize(10); doc.text('MONTO', 126, 62);
  doc.setFontSize(22); doc.setFont('helvetica','bold'); doc.text(`$ ${Number(op.monto).toLocaleString('es-AR')}`, 126, 76);
  doc.setFontSize(9); doc.setFont('helvetica','normal'); doc.setTextColor(139,92,246); doc.text(op.tipo.toUpperCase(), 126, 84);
  doc.setTextColor(139,140,167); doc.setFontSize(9);
  doc.text('Conservá este comprobante. Válido como constancia de operación.', 12, 104);
  doc.setTextColor(212,175,55); doc.setFontSize(8); doc.text('CASINO CONTROL PRO - Sistema Elegante', 12, 285);
  doc.text(`Generado: ${new Date().toLocaleString()}`, 140, 285);
  doc.save(`Comprobante_${(op.cliente_nombre||'Cliente').replace(/\s+/g,'_')}_${op.id}.pdf`);
}
const compartirWhatsApp = (op)=>{
  const texto = `*CASINO CONTROL PRO* 🎰%0A*${op.tipo==='ingreso'?'COMPROBANTE DE CARGA':'COMPROBANTE DE RETIRO'}*%0A%0A👤 Cliente: ${op.cliente_nombre}%0A💰 Monto: $${Number(op.monto).toLocaleString()}%0A💳 Método: ${op.metodo_pago||'efectivo'}%0A${op.referencia?`🔖 Ref: ${op.referencia}%0A`:''}📝 Concepto: ${op.concepto||'-'}%0A👨‍💼 Cajero: ${op.cajero}%0A🕒 Fecha: ${new Date(op.fecha).toLocaleString()}%0A🆔 Op: #${op.id}%0A%0A_Guardá este comprobante_`;
  window.open(`https://wa.me/?text=${texto}`, '_blank');
};

function DashboardPro(){
  const [data,setData]=useState(null); const [desde,setDesde]=useState(''); const [hasta,setHasta]=useState('');
  const cargar=async()=>{ const q=new URLSearchParams(); if(desde) q.append('desde',desde); if(hasta) q.append('hasta',hasta); const r=await fetch(`${API}/dashboard?${q}`); setData(await r.json()); };
  useEffect(()=>{ cargar(); },[]);
  if(!data) return <div style={{padding:24, color:C.gold}}>Cargando dashboard...</div>;
  const pieData=(data.por_metodo||[]).map(m=>({name:m.metodo_pago||'efectivo', value:Number(m.total)}));
  const COLORS=['#D4AF37','#8B5CF6','#10B981','#EF4444','#3B82F6'];
  return (
    <div>
      <div style={{display:'flex', gap:'10px', marginBottom:'20px'}}><input type="date" value={desde} onChange={e=>setDesde(e.target.value)} style={inputStyle}/><input type="date" value={hasta} onChange={e=>setHasta(e.target.value)} style={inputStyle}/><button onClick={cargar} style={btnPrimary}>FILTRAR</button><button onClick={()=>{setDesde(''); setHasta(''); setTimeout(cargar,100)}} style={btnGhost}>LIMPIAR</button></div>
      <div style={{display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'12px', marginBottom:'20px'}}>
        <div style={kpiCard(C.green)}><div style={kpiLabel}>INGRESOS</div><div style={{...kpiValue, color:C.green}}>${Number(data.resumen.total_ingresos).toLocaleString()}</div></div>
        <div style={kpiCard(C.red)}><div style={kpiLabel}>EGRESOS</div><div style={{...kpiValue, color:C.red}}>${Number(data.resumen.total_egresos).toLocaleString()}</div></div>
        <div style={kpiCard(C.gold)}><div style={kpiLabel}>SALDO SISTEMA</div><div style={{...kpiValue, color:C.gold}}>${Number(data.resumen.saldo).toLocaleString()}</div></div>
        <div style={kpiCard(C.purple)}><div style={kpiLabel}>OPERACIONES</div><div style={{...kpiValue, color:C.purple}}>{data.resumen.cantidad_operaciones}</div></div>
      </div>
      <div style={{display:'grid', gridTemplateColumns:'2fr 1fr', gap:'12px', marginBottom:'20px'}}>
        <div style={chartCard}><div style={chartTitle}>Ingresos vs Egresos por Día</div><ResponsiveContainer width="100%" height={300}><BarChart data={data.grafico_diario}><CartesianGrid stroke={C.border} strokeDasharray="3 3"/><XAxis dataKey="dia" stroke={C.textMut} fontSize={11}/><YAxis stroke={C.textMut} fontSize={11}/><Tooltip contentStyle={{background:C.card, border:`1px solid ${C.border}`}}/><Bar dataKey="ingresos" fill={C.green} radius={[8,8,0,0]}/><Bar dataKey="egresos" fill={C.red} radius={[8,8,0,0]}/></BarChart></ResponsiveContainer></div>
        <div style={chartCard}><div style={chartTitle}>Por Método de Pago</div>{pieData.length===0?<div style={{color:C.textMut, padding:40, textAlign:'center'}}>Sin datos</div>:<ResponsiveContainer width="100%" height={300}><PieChart><Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} dataKey="value">{pieData.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}</Pie><Tooltip/><Legend/></PieChart></ResponsiveContainer>}</div>
      </div>
      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px'}}>
        <div style={chartCard}><div style={chartTitle}>🏆 Top 5 Clientes</div>{(data.top_clientes||[]).map((c,i)=><div key={c.id} style={listRow}><span>{i+1}. {c.nombre} {c.apellido}</span><span style={{color:C.gold}}>${Number(c.movimiento_total).toLocaleString()}</span></div>)}</div>
        <div style={chartCard}><div style={chartTitle}>👑 Cajeros</div>{(data.ranking_cajeros||[]).map(r=><div key={r.id} style={listRow}><span>{r.cajero_nombre||r.username}</span><span style={{color:C.purple}}>{r.cantidad_ops} ops</span></div>)}</div>
      </div>
    </div>
  );
}
const inputStyle={padding:'10px 12px', borderRadius:'10px', border:`1px solid ${C.border}`, background:C.card, color:C.text, outline:'none'};
const btnPrimary={padding:'10px 16px', borderRadius:'10px', background:`linear-gradient(135deg, ${C.purple} 0%, ${C.purpleDark} 100%)`, color:'#fff', border:'none', fontWeight:800, cursor:'pointer'};
const btnGold={padding:'10px 16px', borderRadius:'10px', background:`linear-gradient(135deg, ${C.gold} 0%, ${C.goldDark} 100%)`, color:'#000', border:'none', fontWeight:900, cursor:'pointer'};
const btnGhost={padding:'10px 16px', borderRadius:'10px', background:'transparent', color:C.textMut, border:`1px solid ${C.border}`, fontWeight:700, cursor:'pointer'};
const btnRed={padding:'8px 12px', borderRadius:'10px', background:'#EF444415', border:'1px solid #EF444450', color:'#EF4444', fontWeight:800, cursor:'pointer', fontSize:'12px'};
const kpiCard=(a)=>({background:C.card, padding:'16px', borderRadius:'14px', border:`1px solid ${C.border}`, borderLeft:`3px solid ${a}`});
const kpiLabel={color:C.textMut, fontSize:'10px', letterSpacing:'1px'}; const kpiValue={fontSize:'20px', fontWeight:900}; const chartCard={background:C.card, padding:'16px', borderRadius:'14px', border:`1px solid ${C.border}`}; const chartTitle={color:C.text, fontWeight:800, marginBottom:'12px', fontSize:'13px'}; const listRow={display:'flex', justifyContent:'space-between', padding:'10px 0', borderBottom:`1px solid ${C.border}`, fontSize:'13px'};

export default function App(){
  const [user,setUser]=useState(()=>{ const s=localStorage.getItem('cc_user'); return s?JSON.parse(s):null; });
  const [vista,setVista]=useState('dashboard');
  const [loginForm,setLoginForm]=useState({username:'admin', password:'admin123'});
  const [clientes,setClientes]=useState([]); const [operaciones,setOperaciones]=useState([]); const [cierres,setCierres]=useState([]); const [auditoria,setAuditoria]=useState([]); const [users,setUsers]=useState([]);
  const [ficha,setFicha]=useState(null); const [showPassModal,setShowPassModal]=useState(false); const [passForm,setPassForm]=useState({actual:'', nueva:''});
  const [clienteForm,setClienteForm]=useState({nombre:'', apellido:'', dni:'', telefono:'', email:''});
  const [opForm,setOpForm]=useState({cliente_id:'', tipo:'ingreso', monto:'', concepto:'', metodo_pago:'efectivo', referencia:''});
  const [filtroAud,setFiltroAud]=useState({desde:'', hasta:''}); const [arqueo,setArqueo]=useState(''); const [obsCierre,setObsCierre]=useState('');
  const [nuevoUsuario,setNuevoUsuario]=useState({username:'', password:'', nombre:'', rol:'cajero'});

  useEffect(()=>{ if(user) cargarTodo(); },[user,vista]);
  const cargarTodo=async()=>{
    try{
      const [c,o,ci,a,u]=await Promise.all([
        fetch(`${API}/clientes`).then(r=>r.json()),
        fetch(`${API}/operaciones`).then(r=>r.json()),
        fetch(`${API}/cierres`).then(r=>r.json()),
        fetch(`${API}/auditoria`).then(r=>r.json()),
        fetch(`${API}/users`).then(r=>r.json()),
      ]);
      setClientes(c||[]); setOperaciones(o||[]); setCierres(ci||[]); setAuditoria(a||[]); setUsers(u||[]);
    }catch(e){ console.error(e); }
  };
  const handleLogin=async(e)=>{ e.preventDefault(); const r=await fetch(`${API}/login`,{method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(loginForm)}); if(!r.ok){ const er=await r.json(); return alert(er.error); } const u=await r.json(); localStorage.setItem('cc_user', JSON.stringify(u)); setUser(u); };
  const crearCliente=async(e)=>{
    e.preventDefault();
    if(!clienteForm.nombre || !clienteForm.nombre.trim()) return alert('El nombre es obligatorio, apellido y DNI son opcionales');
    await fetch(`${API}/clientes`,{method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({...clienteForm, creado_por:user.id})});
    setClienteForm({nombre:'', apellido:'', dni:'', telefono:'', email:''});
    cargarTodo();
  };
  const [editCliente,setEditCliente]=useState(null);
  const guardarEdicionCliente=async(e)=>{
    e.preventDefault();
    if(!editCliente.nombre || !editCliente.nombre.trim()) return alert('Nombre obligatorio');
    await fetch(`${API}/clientes/${editCliente.id}`,{method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify(editCliente)});
    setEditCliente(null);
    cargarTodo();
  };
  const eliminarCliente=async(id)=>{
    if(!confirm('¿Seguro querés ELIMINAR este cliente?')) return;
    const r=await fetch(`${API}/clientes/${id}`,{method:'DELETE'});
    let j={}; try{ j=await r.json(); }catch(e){ j={}; }
    if(j.error && String(j.error).toLowerCase().includes('operacion')){
      if(!confirm('Este cliente TIENE operaciones. ¿Querés BORRAR TODAS sus operaciones y luego el cliente? Esta acción NO se puede deshacer.')) return;
      // borrar operaciones una por una
      const opsDelCliente = operaciones.filter(o=> String(o.cliente_id)===String(id));
      for(const op of opsDelCliente){
        await fetch(`${API}/operaciones/${op.id}`,{method:'DELETE'});
      }
      // intentar de nuevo borrar cliente
      const r2=await fetch(`${API}/clientes/${id}`,{method:'DELETE'});
      const j2=await r2.json().catch(()=>({}));
      if(j2.error) return alert(j2.error);
      alert('Cliente y sus operaciones eliminados');
      cargarTodo();
      return;
    }
    if(j.error) alert(j.error); else cargarTodo();
  };
  const crearOperacion=async(e)=>{
    e.preventDefault();
    const payload={...opForm, usuario_id:user.id, cliente_id:Number(opForm.cliente_id), monto:Number(opForm.monto)};
    const res=await fetch(`${API}/operaciones`,{method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload)});
    const data=await res.json();
    if(data.id){
      const opTemp={id:data.id, cliente_nombre: clientes.find(x=>String(x.id)===String(opForm.cliente_id))?.nombre || 'Cliente', fecha:new Date().toISOString(), cajero:user.username, ...opForm, monto:Number(opForm.monto)};
      setOpForm({cliente_id:'', tipo:'ingreso', monto:'', concepto:'', metodo_pago:'efectivo', referencia:''});
      await cargarTodo();
      if(confirm('Operación cargada OK. ¿Generar comprobante para WhatsApp ahora?')){ generarComprobantePDF(opTemp, clientes.find(x=>String(x.id)===String(payload.cliente_id))); }
    }
  };
  const eliminarOperacion=async(id)=>{
    if(!confirm('¿Eliminar esta operación? Se va a borrar del historial y auditoría.')) return;
    await fetch(`${API}/operaciones/${id}`,{method:'DELETE'});
    cargarTodo();
  };
  const cargarFicha=async(id)=>{ const r=await fetch(`${API}/clientes/${id}/ficha`); setFicha(await r.json()); };
  const hacerCierre=async()=>{ if(!arqueo) return alert('Poné arqueo'); const r=await fetch(`${API}/cierres`,{method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({usuario_id:user.id, arqueo_real:Number(arqueo), observaciones:obsCierre})}); const j=await r.json(); if(j.id){ setArqueo(''); setObsCierre(''); cargarTodo(); alert(`Cierre ${j.estado} dif ${j.diferencia}`);} };
  const exportarExcel=()=>{ const wb=XLSX.utils.book_new(); const ws1=XLSX.utils.json_to_sheet(auditoria.map(a=>({Fecha:new Date(a.fecha).toLocaleString(), Usuario:a.username, Accion:a.accion, Detalle:a.detalle}))); XLSX.utils.book_append_sheet(wb, ws1, "Auditoria"); const ws2=XLSX.utils.json_to_sheet(operaciones.map(o=>({Fecha:new Date(o.fecha).toLocaleString(), Cliente:o.cliente_nombre, Tipo:o.tipo, Metodo:o.metodo_pago, Monto:o.monto, Ref:o.referencia, Concepto:o.concepto, Cajero:o.cajero}))); XLSX.utils.book_append_sheet(wb, ws2, "Operaciones"); XLSX.writeFile(wb, `Casino_${new Date().toISOString().slice(0,10)}.xlsx`); };
  const exportarPDFOperaciones=()=>{ const doc=new jsPDF(); doc.setFillColor(8,8,15); doc.rect(0,0,210,297,'F'); doc.setTextColor(212,175,55); doc.setFontSize(16); doc.text('CASINO CONTROL - OPERACIONES',10,15); const rows=operaciones.slice(0,300).map(o=>[new Date(o.fecha).toLocaleDateString(), o.cliente_nombre, o.tipo, o.metodo_pago||'efectivo', `$${o.monto}`, o.referencia||'', o.concepto||'']); autoTable(doc,{startY:20, head:[['Fecha','Cliente','Tipo','Metodo','Monto','Ref','Concepto']], body:rows, theme:'grid', headStyles:{fillColor:[139,92,246]}, styles:{fontSize:7}}); doc.save('Operaciones.pdf'); };
  const borrarAuditoria=async()=>{
    if(!confirm('¿Seguro querés BORRAR TODA la auditoría? Esta acción no se puede deshacer.')) return;
    try{
      let r=await fetch(`${API}/auditoria`,{method:'DELETE', headers:{'Content-Type':'application/json'}, body:JSON.stringify({confirmacion:'BORRAR AUDITORIA'})});
      let j={}; try{ j=await r.json(); }catch(e){ j={}; }
      if(r.ok || j.ok){
        alert('Auditoría borrada');
        cargarTodo();
        return;
      }
      // fallback POST
      r=await fetch(`${API}/auditoria/borrar`,{method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({})});
      j={}; try{ j=await r.json(); }catch(e){ j={}; }
      if(r.ok || j.ok){ alert('Auditoría borrada'); cargarTodo(); return; }
      alert('No se pudo borrar: '+(j.error||r.status));
    }catch(e){ alert('Error de conexion: '+e.message); }
  };
  const crearUsuario=async(e)=>{ e.preventDefault(); const r=await fetch(`${API}/users`,{method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({...nuevoUsuario, creador_id:user.id})}); const j=await r.json(); if(j.error) alert(j.error); else { setNuevoUsuario({username:'', password:'', nombre:'', rol:'cajero'}); cargarTodo(); } };
  const eliminarUsuario=async(id)=>{ if(!confirm('¿Eliminar usuario?')) return; const r=await fetch(`${API}/users/${id}`,{method:'DELETE'}); const j=await r.json(); if(j.error) alert(j.error); else cargarTodo(); };
  const hacerBackup=async()=>{ const r=await fetch(`${API}/backup`); const j=await r.json(); if(j.ok) alert(`Backup OK: ${j.archivo}`); else alert('Error'); };
  const cambiarPass=async()=>{ const r=await fetch(`${API}/cambiar-password`,{method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({userId:user.id, actual:passForm.actual, nueva:passForm.nueva})}); const j=await r.json(); if(j.ok){ alert('Contraseña cambiada'); setShowPassModal(false); setPassForm({actual:'', nueva:''}); } else alert(j.error); };

  if(!user){
    return (<div style={{minHeight:'100vh', background:`radial-gradient(1200px at 20% -10%, #1E1B4B 0%, ${C.bg} 60%)`, display:'flex', alignItems:'center', justifyContent:'center'}}><form onSubmit={handleLogin} style={{background:C.card, border:`1px solid ${C.border}`, padding:'36px', borderRadius:'20px', width:'360px'}}><div style={{textAlign:'center', marginBottom:'20px'}}><div style={{width:'50px', height:'50px', margin:'0 auto 10px', background:`linear-gradient(135deg, ${C.purple} 0%, ${C.gold} 100%)`, borderRadius:'14px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'22px'}}>♠️</div><h2 style={{color:C.text, fontWeight:900}}>CASINO CONTROL</h2><p style={{color:C.textMut, fontSize:'12px'}}>Elegante • Negro • Lila • Dorado</p></div><input style={{...inputStyle, width:'100%', marginBottom:'10px'}} placeholder="usuario" value={loginForm.username} onChange={e=>setLoginForm({...loginForm, username:e.target.value})}/><input type="password" style={{...inputStyle, width:'100%', marginBottom:'18px'}} placeholder="contraseña" value={loginForm.password} onChange={e=>setLoginForm({...loginForm, password:e.target.value})}/><button type="submit" style={{...btnPrimary, width:'100%', padding:'12px'}}>INGRESAR</button><p style={{color:C.textMut, fontSize:'11px', textAlign:'center', marginTop:'10px'}}>admin / admin123</p></form></div>);
  }

  const menuBtn=(id,icon,label)=>(
    <button onClick={()=>setVista(id)} style={{display:'flex', alignItems:'center', gap:'10px', width:'100%', padding:'12px 14px', marginBottom:'6px', borderRadius:'12px', background: vista===id ? `linear-gradient(135deg, ${C.purple}15, ${C.gold}15)` : 'transparent', border: vista===id ? `1px solid ${C.purple}40` : '1px solid transparent', color: vista===id ? C.text : C.textMut, fontWeight: vista===id?800:500, cursor:'pointer', textAlign:'left', fontSize:'13px'}}><span>{icon}</span>{label}</button>
  );

  return (
    <div style={{display:'flex', minHeight:'100vh', background:C.bg, color:C.text, fontFamily:'Inter, system-ui'}}>
      <aside style={{width:'260px', background:C.sidebar, borderRight:`1px solid ${C.border}`, padding:'20px', position:'fixed', height:'100vh', display:'flex', flexDirection:'column', overflowY:'auto'}}>
        <div style={{display:'flex', alignItems:'center', gap:'10px', marginBottom:'24px'}}><div style={{width:'36px', height:'36px', borderRadius:'10px', background:`linear-gradient(135deg, ${C.purple} 0%, ${C.gold} 100%)`, display:'flex', alignItems:'center', justifyContent:'center'}}>♠️</div><div><div style={{fontWeight:900, fontSize:'14px'}}>CASINO</div><div style={{fontSize:'10px', color:C.textMut, letterSpacing:'1px'}}>CONTROL PRO</div></div></div>
        <div style={{flex:1}}>
          {menuBtn('dashboard','📊','PANEL')}
          {menuBtn('clientes','👥','CLIENTES')}
          {menuBtn('operaciones','💸','OPERACIONES')}
          {menuBtn('cierres','🔒','CIERRES')}
          {menuBtn('auditoria','📋','AUDITORIA')}
          {menuBtn('usuarios','👤','USUARIOS')}
        </div>
        <div style={{borderTop:`1px solid ${C.border}`, paddingTop:'16px'}}>
          <button onClick={()=>setShowPassModal(true)} style={{...btnGhost, width:'100%', marginBottom:'8px', fontSize:'12px'}}>🔑 CAMBIAR PASE</button>
          <button onClick={hacerBackup} style={{...btnGhost, width:'100%', marginBottom:'8px', fontSize:'12px'}}>💾 COPIA SEGURIDAD</button>
          <button onClick={()=>{localStorage.clear(); setUser(null);}} style={{width:'100%', padding:'10px', borderRadius:'10px', background:'#EF444415', border:'1px solid #EF444430', color:'#EF4444', fontWeight:800, cursor:'pointer'}}>SALIR</button>
          <div style={{marginTop:'12px', textAlign:'center', fontSize:'11px', color:C.textMut}}>{user.nombre}<br/><span style={{color:C.gold}}>{user.username} • {user.rol}</span></div>
        </div>
      </aside>

      <main style={{marginLeft:'260px', flex:1, padding:'28px', background:`radial-gradient(900px at 80% -20%, #1E1B4B30 0%, transparent 60%), ${C.bg}`, minHeight:'100vh'}}>
        <div style={{marginBottom:'20px', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
          <h1 style={{fontSize:'20px', fontWeight:900}}>{vista.toUpperCase()} <span style={{color:C.textMut, fontWeight:400, fontSize:'13px', marginLeft:'8px'}}>Negro • Lila • Dorado</span></h1>
          <div style={{display:'flex', gap:'8px'}}><button onClick={exportarExcel} style={btnGhost}>📊 EXCEL</button><button onClick={exportarPDFOperaciones} style={btnGold}>📄 PDF OPERACIONES</button></div>
        </div>

        {vista==='dashboard' && <DashboardPro />}

        {vista==='clientes' && (
          <div>
            <form onSubmit={crearCliente} style={{...chartCard, display:'flex', gap:'8px', flexWrap:'wrap', marginBottom:'16px'}}>
              <input style={inputStyle} placeholder="Nombre *" value={clienteForm.nombre} onChange={e=>setClienteForm({...clienteForm, nombre:e.target.value})} required />
              <input style={inputStyle} placeholder="Apellido (opcional)" value={clienteForm.apellido} onChange={e=>setClienteForm({...clienteForm, apellido:e.target.value})} />
              <input style={inputStyle} placeholder="DNI (opcional)" value={clienteForm.dni} onChange={e=>setClienteForm({...clienteForm, dni:e.target.value})} />
              <input style={inputStyle} placeholder="Telefono" value={clienteForm.telefono} onChange={e=>setClienteForm({...clienteForm, telefono:e.target.value})} />
              <input style={inputStyle} placeholder="Email" value={clienteForm.email} onChange={e=>setClienteForm({...clienteForm, email:e.target.value})} />
              <button type="submit" style={btnPrimary}>CREAR CLIENTE</button>
            </form>
            {clientes.map(c=>(<div key={c.id} style={{...chartCard, marginBottom:'8px', display:'flex', justifyContent:'space-between', alignItems:'center'}}><span><b style={{color:C.gold}}>{c.nombre} {c.apellido}</b> <span style={{color:C.textMut}}>DNI:{c.dni} | {c.telefono} | Creado por:{c.creador_nombre}</span></span><div style={{display:'flex', gap:'6px'}}><button onClick={()=>cargarFicha(c.id)} style={btnGhost}>FICHA</button><button onClick={()=>setEditCliente(c)} style={{...btnGhost, borderColor:C.gold, color:C.gold}}>✏️ EDITAR</button><button onClick={()=>eliminarCliente(c.id)} style={btnRed}>🗑️ ELIMINAR</button></div></div>))}
          </div>
        )}

        {vista==='operaciones' && (
          <div>
            <form onSubmit={crearOperacion} style={{...chartCard, display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))', gap:'10px', marginBottom:'16px', border:`1px solid ${C.purple}40`}}>
              <select style={inputStyle} value={opForm.cliente_id} onChange={e=>setOpForm({...opForm, cliente_id:e.target.value})} required><option value="">Cliente</option>{clientes.map(c=><option key={c.id} value={c.id}>{c.nombre} {c.apellido}</option>)}</select>
              <select style={inputStyle} value={opForm.tipo} onChange={e=>setOpForm({...opForm, tipo:e.target.value})}><option value="ingreso">INGRESO</option><option value="egreso">EGRESO</option></select>
              <select style={inputStyle} value={opForm.metodo_pago} onChange={e=>setOpForm({...opForm, metodo_pago:e.target.value})}><option value="efectivo">💵 Efectivo</option><option value="transferencia">🏦 Transferencia</option><option value="mercado_pago">💙 Mercado Pago</option><option value="tarjeta">💳 Tarjeta</option><option value="cripto">₿ Cripto</option></select>
              <input style={inputStyle} type="number" placeholder="Monto" value={opForm.monto} onChange={e=>setOpForm({...opForm, monto:e.target.value})} required />
              <input style={inputStyle} placeholder="Referencia / ID Tran" value={opForm.referencia} onChange={e=>setOpForm({...opForm, referencia:e.target.value})} />
              <input style={inputStyle} placeholder="Concepto" value={opForm.concepto} onChange={e=>setOpForm({...opForm, concepto:e.target.value})} />
              <button type="submit" style={btnGold}>CARGAR OPERACIÓN</button>
            </form>
            {operaciones.map(o=>(
              <div key={o.id} style={{...chartCard, marginBottom:'8px', display:'flex', justifyContent:'space-between', alignItems:'center', borderLeft:`3px solid ${o.tipo==='ingreso'?C.green:C.red}`}}>
                <div style={{fontSize:'13px'}}><div style={{fontSize:'11px', color:C.textMut}}>{new Date(o.fecha).toLocaleString()} | #{o.id} | Cajero: {o.cajero}</div><div><b>{o.cliente_nombre}</b> • <b style={{color:C.gold}}>${Number(o.monto).toLocaleString()}</b> • <span style={{color:o.metodo_pago==='mercado_pago'?'#009EE3':C.purple}}>{o.metodo_pago}</span> {o.referencia && <span style={{background:C.sidebar, padding:'2px 6px', borderRadius:'6px', border:`1px solid ${C.border}`, fontSize:'11px'}}>{o.referencia}</span>} • {o.tipo}</div><div style={{fontSize:'11px', color:C.textMut}}>{o.concepto}</div></div>
                <div style={{display:'flex', gap:'6px'}}><button onClick={()=>generarComprobantePDF(o, clientes.find(c=>String(c.id)===String(o.cliente_id)))} style={{...btnGold, padding:'8px 12px', fontSize:'12px'}}>🧾 COMPROBANTE</button><button onClick={()=>compartirWhatsApp(o)} style={{...btnPrimary, padding:'8px 12px', fontSize:'12px', background:'#25D366'}}>📱 WHATSAPP</button><button onClick={()=>eliminarOperacion(o.id)} style={btnRed}>🗑️</button></div>
              </div>
            ))}
          </div>
        )}

        {vista==='cierres' && (
          <div>
            <div style={{...chartCard, display:'flex', gap:'10px', marginBottom:'16px'}}><input style={inputStyle} type="number" placeholder="Arqueo Real" value={arqueo} onChange={e=>setArqueo(e.target.value)}/><input style={inputStyle} placeholder="Observaciones" value={obsCierre} onChange={e=>setObsCierre(e.target.value)}/><button onClick={hacerCierre} style={btnPrimary}>CERRAR CAJA</button></div>
            {cierres.map(c=>(<div key={c.id} style={{...chartCard, marginBottom:'8px', display:'flex', justifyContent:'space-between'}}><div><b style={{color:C.text}}>{new Date(c.fecha_cierre).toLocaleString()}</b> • <span style={{color:c.estado==='CUADRA'?C.green:c.estado==='SOBRANTE'?'#F59E0B':C.red}}>{c.estado} ${c.diferencia}</span><br/><span style={{fontSize:'11px', color:C.textMut}}>Ing:{c.total_ingresos} Egr:{c.total_egresos} Calc:{c.saldo_calculado} Real:{c.arqueo_real} | {c.username}</span></div><button onClick={()=>{ const doc=new jsPDF(); autoTable(doc,{head:[['Campo','Valor']], body:[['Fecha',new Date(c.fecha_cierre).toLocaleString()],['Ingresos',c.total_ingresos],['Egresos',c.total_egresos],['Diferencia',c.diferencia],['Estado',c.estado],['Obs',c.observaciones]]}); doc.save(`Cierre_${c.id}.pdf`); }} style={btnGold}>📄 PDF</button></div>))}
          </div>
        )}

        {vista==='auditoria' && (
          <div>
            <div style={{...chartCard, display:'flex', gap:'8px', marginBottom:'16px', flexWrap:'wrap', alignItems:'center'}}>
              <span style={{color:'#8B8BA7', fontSize:'12px'}}>📅 Fecha ARG: {new Date().toLocaleString('es-AR', {timeZone:'America/Argentina/Buenos_Aires', day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit'})}</span>
              <input type="date" style={inputStyle} value={filtroAud.desde} onChange={e=>setFiltroAud({...filtroAud, desde:e.target.value})}/><input type="date" style={inputStyle} value={filtroAud.hasta} onChange={e=>setFiltroAud({...filtroAud, hasta:e.target.value})}/>
              <button onClick={()=>{setFiltroAud({desde:'', hasta:''})}} style={btnGhost}>LIMPIAR FECHAS</button>
              <button onClick={exportarExcel} style={{...btnPrimary, background:'#10B981'}}>📊 EXCEL (2 hojas)</button>
              <button onClick={()=>{ const doc=new jsPDF(); doc.setFillColor(8,8,15); doc.rect(0,0,210,297,'F'); doc.setTextColor(212,175,55); doc.text('AUDITORIA - CASINO CONTROL PRO',10,15); autoTable(doc,{startY:20, head:[['Fecha','Usuario','Accion','Detalle']], body:auditoria.slice(0,300).map(a=>[new Date(a.fecha).toLocaleString(), a.username||'', a.accion, a.detalle]), theme:'grid', headStyles:{fillColor:[139,92,246]}, styles:{fontSize:8}}); doc.save('Auditoria.pdf'); }} style={btnGold}>📄 PDF AUDITORIA</button>
              <button onClick={borrarAuditoria} style={btnRed}>🗑️ BORRAR AUDITORIA</button>
            </div>
            <div style={{maxHeight:'70vh', overflow:'auto'}}>{auditoria.filter(a=>{ if(!filtroAud.desde && !filtroAud.hasta) return true; const d=new Date(a.fecha).toISOString().slice(0,10); if(filtroAud.desde && d < filtroAud.desde) return false; if(filtroAud.hasta && d > filtroAud.hasta) return false; return true; }).map(a=>(<div key={a.id} style={{...chartCard, marginBottom:'6px', padding:'10px 14px', fontSize:'12px'}}>{new Date(a.fecha).toLocaleString()} | <b style={{color:C.purple}}>{a.username||'-'}</b> | {a.accion} | <span style={{color:C.textMut}}>{a.detalle}</span></div>))}{auditoria.length===0 && <div style={{color:C.textMut, padding:'20px', textAlign:'center'}}>Sin registros aún. Hacé una operación y va a aparecer acá.</div>}</div>
          </div>
        )}

        {vista==='usuarios' && (
          <div>
            <form onSubmit={crearUsuario} style={{...chartCard, display:'flex', gap:'8px', flexWrap:'wrap', marginBottom:'16px'}}><input style={inputStyle} placeholder="usuario" value={nuevoUsuario.username} onChange={e=>setNuevoUsuario({...nuevoUsuario, username:e.target.value})} required/><input style={inputStyle} placeholder="password" type="password" value={nuevoUsuario.password} onChange={e=>setNuevoUsuario({...nuevoUsuario, password:e.target.value})} required/><input style={inputStyle} placeholder="Nombre" value={nuevoUsuario.nombre} onChange={e=>setNuevoUsuario({...nuevoUsuario, nombre:e.target.value})}/><select style={inputStyle} value={nuevoUsuario.rol} onChange={e=>setNuevoUsuario({...nuevoUsuario, rol:e.target.value})}><option value="cajero">cajero</option><option value="admin">admin</option></select><button type="submit" style={btnGold}>CREAR USUARIO</button></form>
            {users.map(u=>(<div key={u.id} style={{...chartCard, marginBottom:'8px', display:'flex', justifyContent:'space-between', alignItems:'center'}}><span><b style={{color:C.gold}}>{u.username}</b> | {u.nombre} | <span style={{color:C.purple}}>{u.rol}</span></span><div style={{display:'flex', gap:'8px', alignItems:'center'}}><span style={{fontSize:'11px', color:C.textMut}}>{new Date(u.creado_en).toLocaleString()}</span>{u.id!==1 && <button onClick={()=>eliminarUsuario(u.id)} style={btnRed}>🗑️ ELIMINAR</button>}</div></div>))}{users.length===0 && <div style={{color:C.textMut, padding:'20px', textAlign:'center'}}>No hay usuarios cargados.</div>}
          </div>
        )}
      </main>

      {editCliente && (
        <div style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.85)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:101, padding:'20px'}}>
          <div style={{background:C.card, border:`1px solid ${C.border}`, borderRadius:'16px', width:'100%', maxWidth:'500px', padding:'20px'}}>
            <h3 style={{color:C.gold, marginBottom:'12px'}}>Editar Cliente #{editCliente.id}</h3>
            <form onSubmit={guardarEdicionCliente} style={{display:'grid', gap:'10px'}}>
              <input style={inputStyle} placeholder="Nombre *" value={editCliente.nombre||''} onChange={e=>setEditCliente({...editCliente, nombre:e.target.value})} required/>
              <input style={inputStyle} placeholder="Apellido (opcional)" value={editCliente.apellido||''} onChange={e=>setEditCliente({...editCliente, apellido:e.target.value})}/>
              <input style={inputStyle} placeholder="DNI (opcional)" value={editCliente.dni||''} onChange={e=>setEditCliente({...editCliente, dni:e.target.value})}/>
              <input style={inputStyle} placeholder="Telefono" value={editCliente.telefono||''} onChange={e=>setEditCliente({...editCliente, telefono:e.target.value})}/>
              <input style={inputStyle} placeholder="Email" value={editCliente.email||''} onChange={e=>setEditCliente({...editCliente, email:e.target.value})}/>
              <div style={{display:'flex', gap:'8px'}}><button type="submit" style={{...btnGold, flex:1}}>GUARDAR</button><button type="button" onClick={()=>setEditCliente(null)} style={{...btnGhost, flex:1}}>CANCELAR</button></div>
            </form>
          </div>
        </div>
      )}
      {ficha && (
        <div style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.85)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:100, padding:'20px'}}><div style={{background:C.card, border:`1px solid ${C.border}`, borderRadius:'16px', width:'100%', maxWidth:'900px', maxHeight:'90vh', overflow:'auto', padding:'20px'}}><div style={{display:'flex', justifyContent:'space-between', marginBottom:'16px'}}><h2 style={{color:C.text, fontWeight:900}}>FICHA {ficha.cliente.nombre} {ficha.cliente.apellido}</h2><button onClick={()=>setFicha(null)} style={btnGhost}>X</button></div><div style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'12px', marginBottom:'16px'}}><div style={kpiCard(C.gold)}><div style={kpiLabel}>SALDO ACTUAL</div><div style={{...kpiValue, color:ficha.saldo_actual>=0?C.green:C.red}}>${Number(ficha.saldo_actual).toLocaleString()}</div></div><div style={kpiCard(C.green)}><div style={kpiLabel}>INGRESOS</div><div style={{...kpiValue, color:C.green}}>${Number(ficha.totales.ingresos).toLocaleString()}</div></div><div style={kpiCard(C.red)}><div style={kpiLabel}>EGRESOS</div><div style={{...kpiValue, color:C.red}}>${Number(ficha.totales.egresos).toLocaleString()}</div></div></div>{ficha.historial.map(h=>(<div key={h.id} style={{...chartCard, marginBottom:'6px', borderLeft:`3px solid ${h.tipo==='ingreso'?C.green:C.red}`, display:'flex', justifyContent:'space-between', alignItems:'center'}}><span style={{fontSize:'12px'}}>{new Date(h.fecha).toLocaleString()} | {h.tipo} ${h.monto} | {h.metodo_pago} | {h.cajero} | {h.referencia}</span><div style={{display:'flex', gap:'6px'}}><button onClick={()=>generarComprobantePDF({id:h.id, cliente_nombre:ficha.cliente.nombre+' '+(ficha.cliente.apellido||''), fecha:h.fecha, tipo:h.tipo, monto:h.monto, metodo_pago:h.metodo_pago, referencia:h.referencia, concepto:h.concepto, cajero:h.cajero}, ficha.cliente)} style={{...btnGold, fontSize:'11px', padding:'6px 10px'}}>🧾 PDF</button><button onClick={()=>compartirWhatsApp({id:h.id, cliente_nombre:ficha.cliente.nombre+' '+(ficha.cliente.apellido||''), fecha:h.fecha, tipo:h.tipo, monto:h.monto, metodo_pago:h.metodo_pago, referencia:h.referencia, concepto:h.concepto, cajero:h.cajero})} style={{...btnPrimary, fontSize:'11px', padding:'6px 10px', background:'#25D366'}}>📱</button></div></div>))}</div></div>
      )}

      {showPassModal && (<div style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:200}}><div style={{background:C.card, padding:'20px', borderRadius:'16px', width:'340px', border:`1px solid ${C.border}`}}><h3 style={{color:C.text, marginBottom:'12px'}}>Cambiar Contraseña</h3><input type="password" style={{...inputStyle, width:'100%', marginBottom:'10px'}} placeholder="Actual" value={passForm.actual} onChange={e=>setPassForm({...passForm, actual:e.target.value})}/><input type="password" style={{...inputStyle, width:'100%', marginBottom:'16px'}} placeholder="Nueva" value={passForm.nueva} onChange={e=>setPassForm({...passForm, nueva:e.target.value})}/><div style={{display:'flex', gap:'8px'}}><button onClick={cambiarPass} style={{...btnPrimary, flex:1}}>GUARDAR</button><button onClick={()=>setShowPassModal(false)} style={{...btnGhost, flex:1}}>CANCELAR</button></div></div></div>)}
    </div>
  );
}
