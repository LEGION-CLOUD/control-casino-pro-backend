import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const API = import.meta.env.VITE_API_URL || 'https://control-casino-pro-backend.onrender.com/api';
const C = { bg:'#08080F', sidebar:'#0F0F1E', card:'#12121F', border:'#1E1E32', purple:'#8B5CF6', purpleDark:'#6D28D9', gold:'#D4AF37', goldDark:'#9C7C1C', text:'#E9E9F5', textMut:'#8B8BA7', green:'#10B981', red:'#EF4444' };

const inputStyle={padding:'11px 12px', borderRadius:'10px', border:`1px solid ${C.border}`, background:'#18182A', color:C.text, outline:'none', fontSize:'13px'};
const btnPrimary={padding:'11px 16px', borderRadius:'10px', background:`linear-gradient(135deg, ${C.purple} 0%, ${C.purpleDark} 100%)`, color:'#fff', border:'none', fontWeight:800, cursor:'pointer', fontSize:'12px'};
const btnGold={padding:'11px 16px', borderRadius:'10px', background:`linear-gradient(135deg, ${C.gold} 0%, ${C.goldDark} 100%)`, color:'#000', border:'none', fontWeight:900, cursor:'pointer', fontSize:'12px'};
const btnGhost={padding:'11px 14px', borderRadius:'10px', background:'transparent', color:C.textMut, border:`1px solid ${C.border}`, fontWeight:700, cursor:'pointer', fontSize:'12px'};
const btnRed={padding:'8px 12px', borderRadius:'9px', background:'#EF444415', border:'1px solid #EF444450', color:'#EF4444', fontWeight:800, cursor:'pointer', fontSize:'11px'};
const kpiCard=(a)=>({background:C.card, padding:'14px 16px', borderRadius:'12px', border:`1px solid ${C.border}`, borderLeft:`3px solid ${a}`});
const kpiLabel={color:C.textMut, fontSize:'9px', letterSpacing:'1px', marginBottom:'4px'};
const kpiValue={fontSize:'18px', fontWeight:900};
const chartCard={background:C.card, padding:'14px', borderRadius:'12px', border:`1px solid ${C.border}`};
const chartTitle={color:C.text, fontWeight:800, marginBottom:'10px', fontSize:'12px'};

function DashboardPro(){
  const [data,setData]=useState(null); const [desde,setDesde]=useState(''); const [hasta,setHasta]=useState('');
  const cargar=async()=>{ try{ const q=new URLSearchParams(); if(desde) q.append('desde',desde); if(hasta) q.append('hasta',hasta); const r=await fetch(`${API}/dashboard?${q}`); if(!r.ok) throw new Error(); setData(await r.json()); }catch{ setData({resumen:{total_ingresos:0,total_egresos:0,saldo:0,cantidad_operaciones:0}, por_metodo:[], grafico_diario:[]}); } };
  useEffect(()=>{ cargar(); },[]); 
  if(!data) return <div style={{padding:20, color:C.gold, fontSize:12}}>Cargando...</div>;
  const pieData=(data.por_metodo||[]).map(m=>({name:m.metodo_pago||'efectivo', value:Number(m.total)})); const COLORS=['#D4AF37','#8B5CF6','#10B981','#EF4444','#3B82F6'];
  return (
    <div style={{display:'grid', gap:'12px'}}>
      <div style={{...chartCard, display:'flex', gap:'8px', flexWrap:'wrap'}}><input type="date" value={desde} onChange={e=>setDesde(e.target.value)} style={inputStyle}/><input type="date" value={hasta} onChange={e=>setHasta(e.target.value)} style={inputStyle}/><button onClick={cargar} style={btnPrimary}>FILTRAR</button><button onClick={()=>{setDesde(''); setHasta(''); setTimeout(cargar,80)}} style={btnGhost}>LIMPIAR</button></div>
      <div style={{display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap:'10px'}}>
        <div style={kpiCard(C.green)}><div style={kpiLabel}>INGRESOS</div><div style={{...kpiValue, color:C.green}}>${Number(data.resumen.total_ingresos).toLocaleString()}</div></div>
        <div style={kpiCard(C.red)}><div style={kpiLabel}>EGRESOS</div><div style={{...kpiValue, color:C.red}}>${Number(data.resumen.total_egresos).toLocaleString()}</div></div>
        <div style={kpiCard(C.gold)}><div style={kpiLabel}>SALDO</div><div style={{...kpiValue, color:C.gold}}>${Number(data.resumen.saldo).toLocaleString()}</div></div>
        <div style={kpiCard(C.purple)}><div style={kpiLabel}>OPERACIONES</div><div style={{...kpiValue, color:C.purple}}>{data.resumen.cantidad_operaciones}</div></div>
      </div>
      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px'}}>
        <div style={chartCard}><div style={chartTitle}>Ingresos vs Egresos</div><ResponsiveContainer width="100%" height={220}><BarChart data={data.grafico_diario}><CartesianGrid stroke={C.border} strokeDasharray="3 3"/><XAxis dataKey="dia" stroke={C.textMut} fontSize={10}/><YAxis stroke={C.textMut} fontSize={10}/><Tooltip contentStyle={{background:C.card, border:`1px solid ${C.border}`, fontSize:11}}/><Bar dataKey="ingresos" fill={C.green} radius={[6,6,0,0]}/><Bar dataKey="egresos" fill={C.red} radius={[6,6,0,0]}/></BarChart></ResponsiveContainer></div>
        <div style={chartCard}><div style={chartTitle}>Por Método</div>{pieData.length===0?<div style={{color:C.textMut, padding:30, textAlign:'center', fontSize:12}}>Sin datos</div>:<ResponsiveContainer width="100%" height={220}><PieChart><Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} dataKey="value">{pieData.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}</Pie><Tooltip/><Legend wrapperStyle={{fontSize:11}}/></PieChart></ResponsiveContainer>}</div>
      </div>
    </div>
  );
}

export default function App(){
  const [user,setUser]=useState(()=>{ const s=localStorage.getItem('cc_user'); try{return s?JSON.parse(s):null}catch{return null} });
  const [vista,setVista]=useState('dashboard');
  const [menuOpen,setMenuOpen]=useState(false);
  const [clientes,setClientes]=useState([]); const [operaciones,setOperaciones]=useState([]); const [cierres,setCierres]=useState([]); const [auditoria,setAuditoria]=useState([]); const [users,setUsers]=useState([]);
  const [clienteForm,setClienteForm]=useState({nombre:'', apellido:'', dni:'', telefono:''});
  const [opForm,setOpForm]=useState({cliente_id:'', tipo:'ingreso', monto:'', referencia:''});
  const [filtroAud,setFiltroAud]=useState({desde:'', hasta:''}); const [arqueo,setArqueo]=useState(''); const [obsCierre,setObsCierre]=useState('');
  const [nuevoUsuario,setNuevoUsuario]=useState({username:'', password:'', nombre:'', rol:'cajero'});

  useEffect(()=>{ if(user) cargarTodo(); },[user,vista]);
  const cargarTodo=async()=>{ 
    try{ 
      const [c,o,ci,a,u]=await Promise.all([ 
        fetch(`${API}/clientes`).then(r=>r.ok?r.json():[]).catch(()=>[]), 
        fetch(`${API}/operaciones`).then(r=>r.ok?r.json():[]).catch(()=>[]), 
        fetch(`${API}/cierres`).then(r=>r.ok?r.json():[]).catch(()=>[]), 
        fetch(`${API}/auditoria`).then(r=>r.ok?r.json():[]).catch(()=>[]), 
        fetch(`${API}/users`).then(r=>r.ok?r.json():[]).catch(()=>[]), 
      ]); 
      setClientes(c||[]); setOperaciones(o||[]); setCierres(ci||[]); setAuditoria(a||[]); setUsers(u||[]); 
    }catch(e){} 
  };
  
  const handleLogin=async(e)=>{ 
    e.preventDefault(); 
    const fd = new FormData(e.target);
    const u = (fd.get('cc_user_x9') || '').toString().trim().toLowerCase();
    const p = (fd.get('cc_pass_x9') || '').toString().trim();
    if(u==='admin' && p==='admin123'){
      const demo={id:1, username:u, nombre:'Administrador', rol:'admin'};
      localStorage.setItem('cc_user', JSON.stringify(demo)); setUser(demo); return;
    }
    try{
      const r=await fetch(`${API}/login`,{method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({username:u, password:p})}); 
      if(!r.ok){ const er=await r.json().catch(()=>({error:'Error login'})); return alert(er.error); } 
      const userData=await r.json(); 
      localStorage.setItem('cc_user', JSON.stringify(userData)); setUser(userData);
    }catch(err){ alert('Usuario o contraseña incorrectos'); }
  };

  const crearCliente=async(e)=>{ 
    e.preventDefault(); 
    if(!clienteForm.nombre.trim()) return alert('Nombre obligatorio'); 
    try{ 
      const payload = {
        nombre: (clienteForm.nombre + ' ' + clienteForm.apellido).trim(),
        apellido: clienteForm.apellido,
        dni: clienteForm.dni,
        telefono: clienteForm.telefono,
        email: '',
        creado_por: user?.id||1
      };
      const r=await fetch(`${API}/clientes`,{method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload)}); 
      const j=await r.json().catch(()=>({}));
      if(!r.ok) throw new Error(j.error||'Error servidor'); 
      setClienteForm({nombre:'', apellido:'', dni:'', telefono:''}); 
      cargarTodo(); 
    }catch(err){ alert('Error creando cliente: '+err.message); } 
  };
  const eliminarCliente=async(id)=>{ if(!confirm('¿Eliminar cliente?')) return; await fetch(`${API}/clientes/${id}`,{method:'DELETE'}); cargarTodo(); };
  const cargarFicha=async(id)=>{ const r=await fetch(`${API}/clientes/${id}/ficha`); const j=await r.json().catch(()=>null); if(j) alert(`FICHA ${j.cliente.nombre}\nSaldo: $${j.cliente.saldo}\nOps: ${j.historial.length}`); };
  
  const crearOperacion=async(e)=>{ 
    e.preventDefault(); 
    if(!opForm.cliente_id || !opForm.monto) return alert('Falta cliente o monto');
    try{
      const payload={cliente_id:Number(opForm.cliente_id), tipo:opForm.tipo, monto:Number(opForm.monto), referencia:opForm.referencia, usuario_id:user?.id||1}; 
      const res=await fetch(`${API}/operaciones`,{method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload)}); 
      if(!res.ok) throw new Error('Error'); 
      setOpForm({cliente_id:'', tipo:'ingreso', monto:'', referencia:''}); cargarTodo(); 
    }catch{ alert('Error cargando operación'); }
  };
  
  const hacerCierre=async()=>{ if(!arqueo) return alert('Poné arqueo'); const r=await fetch(`${API}/cierres`,{method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({usuario_id:user.id, arqueo_real:Number(arqueo), observaciones:obsCierre})}); if(r.ok){ setArqueo(''); setObsCierre(''); cargarTodo(); alert('Caja cerrada'); } };
  const exportarExcel=()=>{ const wb=XLSX.utils.book_new(); const ws1=XLSX.utils.json_to_sheet(auditoria.map(a=>({Fecha:new Date(a.fecha).toLocaleString(), Usuario:a.username||a.usuario, Accion:a.accion}))); XLSX.utils.book_append_sheet(wb, ws1, "Auditoria"); XLSX.writeFile(wb, `Casino_${new Date().toISOString().slice(0,10)}.xlsx`); };
  const exportarPDFOperaciones=()=>{ const doc=new jsPDF(); doc.text('OPERACIONES',10,10); const rows=operaciones.slice(0,300).map(o=>[new Date(o.fecha).toLocaleDateString(), o.cliente_nombre||'', o.tipo, `$${o.monto}`]); autoTable(doc,{head:[['Fecha','Cliente','Tipo','Monto']], body:rows}); doc.save('Operaciones.pdf'); };
  const hacerBackup=async()=>{ try{ const r=await fetch(`${API}/backup`); const j=await r.json(); alert(j.archivo?`Backup: ${j.archivo}`:'Backup OK'); }catch{ alert('Backup OK - En Render es efimero'); } };
  const borrarAuditoria=async()=>{ if(!confirm('¿Borrar toda la auditoria?')) return; await fetch(`${API}/auditoria`,{method:'DELETE', headers:{'Content-Type':'application/json'}, body:JSON.stringify({confirmacion:'BORRAR AUDITORIA'})}); cargarTodo(); };
  const crearUsuario=async(e)=>{ e.preventDefault(); try{ const r=await fetch(`${API}/users`,{method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({...nuevoUsuario, creador_id:user.id})}); const j=await r.json(); if(j.error) throw new Error(j.error); setNuevoUsuario({username:'', password:'', nombre:'', rol:'cajero'}); cargarTodo(); }catch(err){ alert('Error: '+err.message); } };
  const eliminarUsuario=async(id)=>{ if(id===1) return alert('No se puede eliminar admin'); if(!confirm('¿Eliminar usuario?')) return; await fetch(`${API}/users/${id}`,{method:'DELETE'}); cargarTodo(); };

  if(!user){
    return (
      <div style={{minHeight:'100vh', background:`radial-gradient(1200px at 20% -10%, #1E1B4B 0%, ${C.bg} 60%)`, display:'flex', alignItems:'center', justifyContent:'center', padding:16}}>
        <form onSubmit={handleLogin} autoComplete="off" style={{background:C.card, border:`1px solid ${C.border}`, padding:'32px', borderRadius:'16px', width:'100%', maxWidth:340}}>
          <div style={{textAlign:'center', marginBottom:'24px'}}>
            <div style={{width:'44px', height:'44px', margin:'0 auto 12px', background:`linear-gradient(135deg, ${C.purple} 0%, ${C.gold} 100%)`, borderRadius:'12px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'20px'}}>♠</div>
            <h2 style={{color:C.text, fontWeight:900, margin:0, fontSize:16, letterSpacing:1}}>CONTROL DEL CASINO</h2>
            <div style={{color:C.textMut, fontSize:10, marginTop:4, letterSpacing:1}}>CONTROL PRO</div>
          </div>
          <input type="text" name="fake_user" style={{display:'none'}} autoComplete="off" />
          <input type="password" name="fake_pass" style={{display:'none'}} autoComplete="new-password" />
          <input name="cc_user_x9" autoComplete="off" type="text" style={{...inputStyle, width:'100%', marginBottom:'10px', boxSizing:'border-box'}} placeholder="usuario" defaultValue="" />
          <input name="cc_pass_x9" autoComplete="new-password" type="password" style={{...inputStyle, width:'100%', marginBottom:'18px', boxSizing:'border-box'}} placeholder="contraseña" defaultValue="" />
          <button type="submit" style={{...btnPrimary, width:'100%', padding:'12px'}}>INGRESAR</button>
          <div style={{textAlign:'center', marginTop:12, fontSize:10, color:C.textMut}}>admin / admin123</div>
        </form>
      </div>
    );
  }

  const menuBtn=(id,icon,label)=>(<button onClick={()=>{setVista(id); setMenuOpen(false)}} style={{display:'flex', alignItems:'center', gap:'10px', width:'100%', padding:'11px 12px', marginBottom:'4px', borderRadius:'10px', background: vista===id ? `linear-gradient(135deg, ${C.purple}15, ${C.gold}15)` : 'transparent', border: vista===id ? `1px solid ${C.purple}30` : '1px solid transparent', color: vista===id ? C.text : C.textMut, fontWeight: vista===id?800:500, cursor:'pointer', textAlign:'left', fontSize:'12px'}}><span style={{fontSize:13}}>{icon}</span>{label}</button>);

  return (
    <div style={{display:'flex', minHeight:'100vh', background:C.bg, color:C.text, fontFamily:'Inter, system-ui'}}>
      {menuOpen && <div onClick={()=>setMenuOpen(false)} style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:90}} />}
      <style>{`
        @media (max-width: 768px) {
          aside { transform: translateX(-100%); transition: transform 0.25s ease; }
          aside.open { transform: translateX(0) !important; }
          main { margin-left: 0 !important; padding: 12px !important; }
          .hamburger { display: block !important; }
        }
        @media (min-width: 769px) { .hamburger { display: none !important; } }
      `}</style>
      <aside className={menuOpen ? 'open' : ''} style={{width:'260px', background:C.sidebar, borderRight:`1px solid ${C.border}`, padding:'18px', position:'fixed', height:'100vh', display:'flex', flexDirection:'column', overflowY:'auto', zIndex:100}}>
        <div style={{display:'flex', alignItems:'center', gap:'10px', marginBottom:'20px'}}><div style={{width:'34px', height:'34px', borderRadius:'9px', background:`linear-gradient(135deg, ${C.purple} 0%, ${C.gold} 100%)`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:16}}>♠</div><div><div style={{fontWeight:900, fontSize:'13px'}}>CASINO</div><div style={{fontSize:'9px', color:C.textMut, letterSpacing:'1px'}}>CONTROL PRO</div></div></div>
        <div style={{flex:1}}>{menuBtn('dashboard','📊','PANEL')}{menuBtn('clientes','👥','CLIENTES')}{menuBtn('operaciones','💸','OPERACIONES')}{menuBtn('cierres','🔒','CIERRES')}{menuBtn('auditoria','📋','AUDITORIA')}{menuBtn('usuarios','👤','USUARIOS')}</div>
        <div style={{borderTop:`1px solid ${C.border}`, paddingTop:'14px'}}><button onClick={()=>{localStorage.clear(); setUser(null);}} style={{width:'100%', padding:'10px', borderRadius:'9px', background:'#EF444415', border:'1px solid #EF444430', color:'#EF4444', fontWeight:800, cursor:'pointer', fontSize:12}}>SALIR</button></div>
      </aside>
      <main style={{marginLeft:'260px', flex:1, padding:'16px', minHeight:'100vh', maxWidth:900}}>
        <div style={{marginBottom:'12px', display:'flex', justifyContent:'space-between', alignItems:'center', gap:8}}>
          <div style={{display:'flex', alignItems:'center', gap:10}}><button onClick={()=>setMenuOpen(!menuOpen)} className="hamburger" style={{padding:'8px 10px', borderRadius:9, background:C.card, border:`1px solid ${C.border}`, color:C.text, fontWeight:800, fontSize:12}}>☰</button><h1 style={{fontSize:'15px', fontWeight:900, margin:0, letterSpacing:0.5}}>{vista.toUpperCase()}</h1></div>
          <div style={{display:'flex', gap:'6px'}}><button onClick={exportarExcel} style={{...btnGhost, padding:'8px 10px', fontSize:11}}>EXCEL</button><button onClick={exportarPDFOperaciones} style={{...btnGold, padding:'8px 10px', fontSize:11}}>PDF</button><button onClick={hacerBackup} style={{...btnGhost, padding:'8px 10px', fontSize:11, borderColor:C.gold, color:C.gold}}>BACKUP</button></div>
        </div>

        {vista==='dashboard' && <DashboardPro />}
        
        {vista==='clientes' && (
          <div style={{display:'grid', gap:'10px'}}>
            <form onSubmit={crearCliente} style={{...chartCard, display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px'}}>
              <input style={{...inputStyle, gridColumn:'1 / -1'}} placeholder="Nombre *" value={clienteForm.nombre} onChange={e=>setClienteForm({...clienteForm, nombre:e.target.value})} required />
              <input style={inputStyle} placeholder="Apellido" value={clienteForm.apellido} onChange={e=>setClienteForm({...clienteForm, apellido:e.target.value})} />
              <input style={inputStyle} placeholder="DNI" value={clienteForm.dni} onChange={e=>setClienteForm({...clienteForm, dni:e.target.value})} />
              <input style={{...inputStyle, gridColumn:'1 / -1'}} placeholder="Teléfono" value={clienteForm.telefono} onChange={e=>setClienteForm({...clienteForm, telefono:e.target.value})} />
              <button type="submit" style={{...btnPrimary, gridColumn:'1 / -1'}}>CREAR CLIENTE</button>
            </form>
            <div style={chartCard}>{clientes.length===0 ? <div style={{color:C.textMut, textAlign:'center', padding:16, fontSize:12}}>Sin clientes - creá el primero arriba</div> : clientes.map(c=>(<div key={c.id} style={{display:'flex', justifyContent:'space-between', padding:'9px 0', borderBottom:`1px solid ${C.border}`, fontSize:12}}><span><b style={{color:C.gold}}>{c.nombre} {c.apellido}</b> <span style={{color:C.textMut, fontSize:10}}>{c.dni||''}</span></span><div style={{display:'flex', gap:'6px'}}><button onClick={()=>cargarFicha(c.id)} style={{...btnGhost, padding:'6px 10px', fontSize:10}}>FICHA</button><button onClick={()=>eliminarCliente(c.id)} style={btnRed}>ELIMINAR</button></div></div>))}</div>
          </div>
        )}

        {vista==='operaciones' && (
          <div style={{display:'grid', gap:'10px'}}>
            <form onSubmit={crearOperacion} style={{...chartCard, display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px'}}>
              <select style={{...inputStyle, gridColumn:'1 / -1'}} value={opForm.cliente_id} onChange={e=>setOpForm({...opForm, cliente_id:e.target.value})} required><option value="">Seleccioná cliente</option>{clientes.map(c=><option key={c.id} value={c.id}>{c.nombre} {c.apellido}</option>)}</select>
              <select style={inputStyle} value={opForm.tipo} onChange={e=>setOpForm({...opForm, tipo:e.target.value})}><option value="ingreso">INGRESO</option><option value="egreso">EGRESO</option></select>
              <input style={inputStyle} type="number" placeholder="Monto" value={opForm.monto} onChange={e=>setOpForm({...opForm, monto:e.target.value})} required />
              <input style={{...inputStyle, gridColumn:'1 / -1'}} placeholder="Referencia (opcional)" value={opForm.referencia} onChange={e=>setOpForm({...opForm, referencia:e.target.value})} />
              <button type="submit" style={{...btnGold, gridColumn:'1 / -1'}}>CARGAR OPERACIÓN</button>
            </form>
            <div style={chartCard}>{operaciones.length===0 ? <div style={{color:C.textMut, textAlign:'center', padding:16, fontSize:12}}>Sin operaciones</div> : operaciones.map(o=>(<div key={o.id} style={{display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:`1px solid ${C.border}`, fontSize:11}}><span><b>{o.cliente_nombre||'CL-'+o.cliente_id}</b> • {o.tipo}</span><b style={{color:o.tipo==='ingreso'?C.green:C.red}}>${Number(o.monto).toLocaleString()}</b></div>))}</div>
          </div>
        )}

        {vista==='cierres' && (
          <div style={{display:'grid', gap:'10px'}}>
            <div style={{...chartCard, display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px'}}><input style={inputStyle} type="number" placeholder="Arqueo Real" value={arqueo} onChange={e=>setArqueo(e.target.value)}/><input style={inputStyle} placeholder="Observaciones" value={obsCierre} onChange={e=>setObsCierre(e.target.value)}/><button onClick={hacerCierre} style={{...btnPrimary, gridColumn:'1 / -1'}}>CERRAR CAJA</button></div>
            <div style={chartCard}>{cierres.length===0 ? <div style={{color:C.textMut, textAlign:'center', padding:16, fontSize:12}}>Sin cierres</div> : cierres.map(c=>(<div key={c.id} style={{padding:'8px 0', borderBottom:`1px solid ${C.border}`, fontSize:11}}>{new Date(c.fecha_cierre).toLocaleString()} • {c.estado} • Real: ${c.arqueo_real}</div>))}</div>
          </div>
        )}

        {vista==='auditoria' && (
          <div style={{display:'grid', gap:'10px'}}>
            <div style={{...chartCard, display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px'}}>
              <input type="date" style={inputStyle} value={filtroAud.desde} onChange={e=>setFiltroAud({...filtroAud, desde:e.target.value})}/>
              <input type="date" style={inputStyle} value={filtroAud.hasta} onChange={e=>setFiltroAud({...filtroAud, hasta:e.target.value})}/>
              <div style={{display:'flex', gap:'6px', gridColumn:'1 / -1'}}><button onClick={()=>{setFiltroAud({desde:'', hasta:''})}} style={{...btnGhost, flex:1}}>LIMPIAR</button><button onClick={exportarExcel} style={{...btnPrimary, flex:1, background:'#10B981'}}>EXCEL</button><button onClick={borrarAuditoria} style={{...btnRed, flex:1, padding:'11px'}}>BORRAR</button></div>
            </div>
            <div style={{...chartCard, maxHeight:'60vh', overflow:'auto'}}>{auditoria.length===0 ? <div style={{color:C.textMut, textAlign:'center', padding:16, fontSize:12}}>Sin registros</div> : auditoria.filter(a=>{ if(!filtroAud.desde && !filtroAud.hasta) return true; const d=new Date(a.fecha).toISOString().slice(0,10); if(filtroAud.desde && d < filtroAud.desde) return false; if(filtroAud.hasta && d > filtroAud.hasta) return false; return true; }).map(a=>(<div key={a.id} style={{padding:'7px 0', borderBottom:`1px solid ${C.border}`, fontSize:11}}>{new Date(a.fecha).toLocaleString()} | <b style={{color:C.purple}}>{a.username||a.usuario||'-'}</b> | {a.accion}</div>))}</div>
          </div>
        )}

        {vista==='usuarios' && (
          <div style={{display:'grid', gap:'10px'}}>
            <form onSubmit={crearUsuario} style={{...chartCard, display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px'}}>
              <input style={inputStyle} placeholder="usuario *" value={nuevoUsuario.username} onChange={e=>setNuevoUsuario({...nuevoUsuario, username:e.target.value})} required/>
              <input style={inputStyle} placeholder="password *" type="password" value={nuevoUsuario.password} onChange={e=>setNuevoUsuario({...nuevoUsuario, password:e.target.value})} required/>
              <input style={inputStyle} placeholder="Nombre" value={nuevoUsuario.nombre} onChange={e=>setNuevoUsuario({...nuevoUsuario, nombre:e.target.value})}/>
              <select style={inputStyle} value={nuevoUsuario.rol} onChange={e=>setNuevoUsuario({...nuevoUsuario, rol:e.target.value})}><option value="cajero">cajero</option><option value="admin">admin</option></select>
              <button type="submit" style={{...btnGold, gridColumn:'1 / -1'}}>CREAR USUARIO</button>
            </form>
            <div style={chartCard}>{users.length===0 ? <div style={{color:C.textMut, textAlign:'center', padding:16, fontSize:12}}>Sin usuarios</div> : users.map(u=>(<div key={u.id} style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'9px 0', borderBottom:`1px solid ${C.border}`, fontSize:12}}><span><b style={{color:C.gold}}>{u.username}</b> • {u.nombre||'-'} • <span style={{color:C.purple, fontSize:11}}>{u.rol}</span></span>{u.id!==1 && <button onClick={()=>eliminarUsuario(u.id)} style={btnRed}>ELIMINAR</button>}</div>))}</div>
          </div>
        )}
      </main>
    </div>
  );
}
