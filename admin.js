const SUPABASE_URL = 'https://ducmehygksmijtynfuzt.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR1Y21laHlna3NtaWp0eW5mdXp0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU2NTgyNTQsImV4cCI6MjA4MTIzNDI1NH0.Zo0RTm5fPn-sA6AkqSIPCCiehn8iW2Ou4I26HnC2CfU';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

document.addEventListener('DOMContentLoaded', async () => {

    if(sessionStorage.getItem('role') !== 'admin') window.location.href = 'login.html';
    
    const menuItems = document.querySelectorAll('.menu-item:not(.logout)');
    const sections = document.querySelectorAll('.content-section');

    menuItems.forEach(item => {
        item.addEventListener('click', () => {
            menuItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            const targetId = item.getAttribute('data-target');
            sections.forEach(sec => sec.classList.remove('active-section'));
            document.getElementById(targetId).classList.add('active-section');
            if(window.innerWidth < 768) toggleSidebar();
            
            if(targetId === 'dashboard') initDashboard();
            if(targetId === 'menu-management') loadMenuItems(); // Load Menu
            if(targetId === 'customers') loadAllCustomers();
            if(targetId === 'sales') quickReport(30);
            if(targetId === 'users') loadStaffList();
            if(targetId === 'templates') loadCurrentTheme(); 
            if(targetId === 'reviews') loadReviews();
            if(targetId === 'messages') loadMessages();
            if(targetId === 'discounts') loadDiscounts();
        });
    });

    window.toggleSidebar = function() {
        document.querySelector('.sidebar').classList.toggle('active');
        document.querySelector('.sidebar-overlay').classList.toggle('active');
    }

    // ==========================================
    // MENU MANAGEMENT (NEW LOGIC)
    // ==========================================
    let editingMenuId = null;

    window.openMenuModal = function(mode, dataJson = null) {
        document.getElementById('menu-modal').style.display = 'flex';
        const titleEl = document.getElementById('menu-modal-title');
        const btnEl = document.getElementById('save-menu-btn');
        
        if (mode === 'add') {
            editingMenuId = null;
            titleEl.innerText = 'Add Menu Item';
            btnEl.innerText = 'Confirm';
            // Clear inputs
            document.getElementById('menu-cat').value = 'Main Course';
            document.getElementById('menu-name').value = '';
            document.getElementById('menu-desc').value = '';
            document.getElementById('menu-price').value = '';
            document.getElementById('menu-img').value = ''; 
        } else {
            // Edit Mode
            editingMenuId = dataJson.id;
            titleEl.innerText = 'Edit Menu Item';
            btnEl.innerText = 'Update';
            
            document.getElementById('menu-cat').value = dataJson.category;
            document.getElementById('menu-name').value = dataJson.name;
            document.getElementById('menu-desc').value = dataJson.description;
            document.getElementById('menu-price').value = dataJson.price;
            // Note: File input cannot be pre-filled for security, user re-uploads if changing.
        }
    }

    window.saveMenuItem = async function() {
        const category = document.getElementById('menu-cat').value;
        const name = document.getElementById('menu-name').value;
        const desc = document.getElementById('menu-desc').value;
        const price = parseFloat(document.getElementById('menu-price').value);
        const imgInput = document.getElementById('menu-img');
        
        if (!name || !price) return alert("Name and Price are required.");

        let imgData = null;
        if (imgInput.files && imgInput.files[0]) {
            // Convert to Base64 for demo storage
            imgData = await toBase64(imgInput.files[0]);
        }

        const payload = {
            category,
            name,
            description: desc,
            price,
            status: editingMenuId ? undefined : 'active' // Default active for new
        };
        if (imgData) payload.image_url = imgData; // Update image only if new one selected

        if (editingMenuId) {
            // Update
            const { error } = await supabaseClient.from('menu_items').update(payload).eq('id', editingMenuId);
            if(error) alert("Error updating: " + error.message);
            else { alert("Updated!"); document.getElementById('menu-modal').style.display = 'none'; loadMenuItems(); }
        } else {
            // Insert
            const { error } = await supabaseClient.from('menu_items').insert([payload]);
            if(error) alert("Error creating: " + error.message);
            else { alert("Created!"); document.getElementById('menu-modal').style.display = 'none'; loadMenuItems(); }
        }
    }

    window.loadMenuItems = async function() {
        const container = document.getElementById('menu-list-container');
        container.innerHTML = 'Loading...';

        const { data, error } = await supabaseClient.from('menu_items').select('*').order('created_at', {ascending: false});
        
        if (error || !data || data.length === 0) {
            container.innerHTML = '<div style="padding:15px;color:#888;">No items found.</div>';
            return;
        }

        container.innerHTML = '';
        data.forEach(item => {
            const jsonItem = JSON.stringify(item).replace(/"/g, '&quot;');
            
            // Status Logic
            const isActive = item.status === 'active';
            const statusClass = isActive ? 'status-active' : 'status-inactive';
            const statusLabel = isActive ? 'Active' : 'Inactive';
            const statusBtnHtml = `<span class="status-toggle-btn ${statusClass}" onclick="toggleMenuStatus(${item.id}, '${item.status}')">${statusLabel}</span>`;

            // Image Logic
            const imgHtml = item.image_url 
                ? `<img src="${item.image_url}" style="width:100%; height:100%; object-fit:cover;">` 
                : `<i class="ri-image-2-line" style="font-size:20px; color:#ccc;"></i>`;

            const row = document.createElement('div');
            row.className = 'table-row';
            row.innerHTML = `
                <span class="flex-1"><div class="menu-img-box">${imgHtml}</div></span>
                <span class="flex-2 font-600">${item.name}</span>
                <span class="flex-1 text-sm-grey">${item.category}</span>
                <span class="flex-1 font-500">$${item.price}</span>
                <span class="flex-1">${statusBtnHtml}</span>
                <span class="flex-1 text-right" style="display:flex; justify-content:flex-end; gap:10px;">
                    <button onclick="openMenuPreview(${jsonItem})" style="background:none; border:none; color:#3498DB; cursor:pointer;" title="View"><i class="ri-eye-line" style="font-size:18px;"></i></button>
                    <button onclick="openMenuModal('edit', ${jsonItem})" style="background:none; border:none; color:#F39C12; cursor:pointer;" title="Edit"><i class="ri-pencil-line" style="font-size:18px;"></i></button>
                </span>
            `;
            container.appendChild(row);
        });
    }

    window.toggleMenuStatus = async function(id, currentStatus) {
        const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
        await supabaseClient.from('menu_items').update({ status: newStatus }).eq('id', id);
        loadMenuItems(); // Refresh list
    }

    window.openMenuPreview = function(item) {
        document.getElementById('prev-name').innerText = item.name;
        document.getElementById('prev-desc').innerText = item.description || 'No description.';
        document.getElementById('prev-price').innerText = '$' + item.price;
        const imgEl = document.getElementById('prev-img');
        if (item.image_url) imgEl.src = item.image_url;
        else imgEl.src = ''; 
        
        document.getElementById('menu-preview-modal').style.display = 'flex';
    }

    // Helper: File to Base64
    const toBase64 = file => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });

    // --- TEMPLATES LOGIC ---
    async function loadCurrentTheme() {
        const { data } = await supabaseClient.from('settings').select('value').eq('key', 'active_theme').single();
        const current = data ? data.value : 'default';
        updateThemeUI(current);
    }

    window.setTheme = async function(themeName, el) {
        updateThemeUI(themeName);
        await supabaseClient.from('settings').upsert({key: 'active_theme', value: themeName});
        alert(`Theme updated to ${themeName}! Refresh menu page to see changes.`);
    }

    function updateThemeUI(themeName) {
        document.querySelectorAll('.template-card').forEach(c => c.classList.remove('active-theme'));
        const cards = document.querySelectorAll('.template-card');
        if(themeName === 'default') cards[0].classList.add('active-theme');
        if(themeName === 'dark') cards[1].classList.add('active-theme');
        if(themeName === 'ocean') cards[2].classList.add('active-theme');
    }

    // --- DASHBOARD ---
    async function initDashboard() {
        const now = new Date();
        const f = new Date(now.getFullYear(), now.getMonth(), 1);
        document.getElementById('dashboard-date-title').innerText = `${f.getDate()} ${f.toLocaleString('en',{month:'short'})} - ${now.getDate()} ${now.toLocaleString('en',{month:'short'})} ${now.getFullYear()}`;
        loadMonthStats();
        const { data } = await supabaseClient.from('settings').select('*');
        if(data) data.forEach(s => { const el=document.querySelector(`#chip-${s.key} .val`); if(el) el.innerText=s.value; });
    }
    document.getElementById('save-wh-btn').onclick = async () => {
        const updates = [
            {key:'start-time',value:document.querySelector('#chip-start-time .val').innerText},
            {key:'end-time',value:document.querySelector('#chip-end-time .val').innerText},
            {key:'start-day',value:document.querySelector('#chip-start-day .val').innerText},
            {key:'end-day',value:document.querySelector('#chip-end-day .val').innerText}
        ];
        for(let u of updates) await supabaseClient.from('settings').upsert(u);
        alert("Working hours saved!");
    };
    async function loadMonthStats() {
        const d = new Date(); d.setDate(1);
        const { data } = await supabaseClient.from('orders').select('total_amount').eq('status','completed').gte('created_at', d.toISOString());
        if(data) {
            const r = data.reduce((a,b)=>a+(parseFloat(b.total_amount)||0),0);
            document.getElementById('month-orders').innerText = data.length;
            document.getElementById('month-revenue').innerText = '$'+r.toLocaleString();
        }
    }

    // --- CUSTOMERS ---
    window.switchCustomerTab = function(type, el) {
        document.querySelectorAll('#customers .pill-tab').forEach(t => t.classList.remove('active-tab'));
        el.classList.add('active-tab');
        if(type==='all') loadAllCustomers(); if(type==='loyal') loadLoyalCustomers(); if(type==='valuable') loadMostValuable(); if(type==='interests') loadInterests();
    }
    async function loadAllCustomers() {
        renderHeader(['Name','Phone','Joined']);
        const {data}=await supabaseClient.from('customers').select('*');
        renderList(data, c=>`<span style="flex:1;font-weight:500;">${c.name}</span><span style="flex:1">${c.phone}</span><span style="flex:1;text-align:right;">${new Date(c.created_at).toLocaleDateString()}</span>`);
    }
    async function loadLoyalCustomers() {
        renderHeader(['Name','Phone','Orders']);
        const {data}=await supabaseClient.from('loyal_customers_view').select('*');
        renderList(data, c=>`<span style="flex:1;font-weight:500;">${c.name}</span><span style="flex:1">${c.phone}</span><span style="flex:1;text-align:right;font-weight:bold;">${c.order_count}</span>`);
    }
    async function loadMostValuable() {
        renderHeader(['Name','Spent (1 Yr)','Value']);
        const d=new Date(); d.setFullYear(d.getFullYear()-1);
        const {data}=await supabaseClient.from('orders').select('customer_id,total_amount,customers(name)').eq('status','completed').gte('created_at',d.toISOString());
        const m={}; if(data) data.forEach(o=>{ const i=o.customer_id; if(!m[i]) m[i]={name:o.customers.name,t:0}; m[i].t+=parseFloat(o.total_amount); });
        const s=Object.values(m).sort((a,b)=>b.t-a.t);
        renderList(s, c=>`<span style="flex:1;font-weight:500;">${c.name}</span><span style="flex:1;color:#2ECC71;">$${c.t.toFixed(2)}</span><span style="flex:1;text-align:right;color:#FF724C;">${(c.t*0.1).toFixed(1)}</span>`);
    }
    async function loadInterests() {
        renderHeader(['Customer','Top 3','Fav Food']);
        const {data}=await supabaseClient.from('order_items').select('product_name,ingredients,orders(customer_id,customers(name))');
        const m={}; if(data) data.forEach(i=>{ if(!i.orders)return; const cid=i.orders.customer_id; if(!m[cid])m[cid]={name:i.orders.customers.name,f:{},i:{}}; m[cid].f[i.product_name]=(m[cid].f[i.product_name]||0)+1; if(i.ingredients) i.ingredients.split(',').forEach(x=>{ const k=x.trim(); m[cid].i[k]=(m[cid].i[k]||0)+1; }); });
        const l=Object.values(m).map(c=>{ const tf=Object.entries(c.f).sort((a,b)=>b[1]-a[1])[0]?.[0]||'-'; const ti=Object.entries(c.i).sort((a,b)=>b[1]-a[1]).slice(0,3).map(x=>x[0]).join(', '); return{name:c.name,tf,ti}; });
        renderList(l, c=>`<span style="flex:1;font-weight:500;">${c.name}</span><span style="flex:1;font-size:12px;">${c.ti}</span><span style="flex:1;text-align:right;color:#FF724C;">${c.tf}</span>`);
    }
    function renderHeader(t){ document.getElementById('customer-header').innerHTML=t.map((x,i)=>`<span class="header-item" style="flex:1;${i==t.length-1?'text-align:right':''}">${x}</span>`).join(''); }
    function renderList(d,fn){ const c=document.getElementById('customer-list'); c.innerHTML=''; if(!d||!d.length)c.innerHTML='<p style="padding:15px;color:#aaa">No data.</p>'; else d.forEach(x=>{ const r=document.createElement('div'); r.className='table-row'; r.innerHTML=fn(x); c.appendChild(r); }); }

    // --- SALES ---
    window.switchSalesMode = function(m, el) { document.querySelectorAll('#sales .pill-tab').forEach(t=>t.classList.remove('active-tab')); el.classList.add('active-tab'); document.getElementById('sales-cash-view').style.display=m==='cash'?'block':'none'; document.getElementById('sales-product-view').style.display=m==='product'?'block':'none'; if(m==='product') setProductFilter(7,'Last 7 Days'); }
    window.quickReport = async function(d) { const s=new Date(); s.setDate(s.getDate()-d); const {data}=await supabaseClient.from('orders').select('total_amount').eq('status','completed').gte('created_at',s.toISOString()); const t=data?data.reduce((a,b)=>a+(parseFloat(b.total_amount)||0),0):0; document.getElementById('report-revenue').innerText='$'+t.toLocaleString(); }
    window.setProductFilter = async function(v, l) {
        document.querySelector('#chip-prod-range .val').innerText=l; document.querySelector('.chip-menu').classList.remove('show');
        let s=new Date(),e=new Date(); if(typeof v==='number') s.setDate(s.getDate()-v); else { const y=e.getFullYear(); if(v==='Spring'){s=new Date(y,2,21);e=new Date(y,5,21);} if(v==='Summer'){s=new Date(y,5,22);e=new Date(y,8,22);} if(v==='Autumn'){s=new Date(y,8,23);e=new Date(y,11,21);} if(v==='Winter'){s=new Date(y,11,22);e=new Date(y+1,2,20);} }
        const {data}=await supabaseClient.from('order_items').select('product_name,final_price,quantity').gte('created_at',s.toISOString()).lte('created_at',e.toISOString());
        const ls=document.getElementById('product-list'); ls.innerHTML='';
        if(data){ const a={}; data.forEach(i=>{ if(!a[i.product_name])a[i.product_name]={q:0,t:0}; a[i.product_name].q+=i.quantity; a[i.product_name].t+=i.quantity*i.final_price; });
        Object.entries(a).forEach(([n,st])=>{ ls.innerHTML+=`<div class="table-row"><span style="flex:2;font-weight:500;">${n}</span><span style="flex:1;">${st.q}</span><span style="flex:1;text-align:right;">$${st.t.toFixed(2)}</span></div>`; }); }
    }

    // --- USERS ---
    window.switchUserTab = function(t, el) { document.querySelectorAll('#users .pill-tab').forEach(x=>x.classList.remove('active-tab')); el.classList.add('active-tab'); document.getElementById('user-tab-staff').style.display=t==='staff'?'block':'none'; document.getElementById('user-tab-admin').style.display=t==='admin'?'block':'none'; if(t==='staff') loadStaffList(); else loadAdminList(); }
    document.getElementById('create-btn').onclick=async()=>{ const u=document.getElementById('new-user').value; const p=document.getElementById('new-pass').value; await supabaseClient.from('staff').insert([{username:u,password:p}]); loadStaffList(); };
    document.getElementById('create-admin-btn').onclick=async()=>{ const u=document.getElementById('admin-user').value; const p=document.getElementById('admin-pass').value; await supabaseClient.from('admins').insert([{username:u,password:p}]); loadAdminList(); };
    async function loadStaffList(){ const c=document.getElementById('staff-list-container'); const {data}=await supabaseClient.from('staff').select('*'); renderU(c,data,'staff'); }
    async function loadAdminList(){ const c=document.getElementById('admin-list-container'); const {data}=await supabaseClient.from('admins').select('*'); renderU(c,data,'admins'); }
    function renderU(c,d,t){ c.innerHTML=''; if(d)d.forEach(u=>{ const div=document.createElement('div'); div.className='table-row'; div.innerHTML=`<span style="flex:1;font-weight:500;">${u.username}</span><span style="flex:1;text-align:right;"><button onclick="changePass('${t}',${u.id})" style="background:none;border:none;color:#F39C12;cursor:pointer;margin-right:10px;">Pass</button><button onclick="deleteUser('${t}',${u.id})" style="background:none;border:none;color:#E74C3C;cursor:pointer;">Delete</button></span>`; c.appendChild(div); }); }
    window.changePass=async(t,id)=>{ const p=prompt('New Pass:'); if(p)await supabaseClient.from(t).update({password:p}).eq('id',id); }
    window.deleteUser=async(t,id)=>{ if(confirm('Delete?')){ await supabaseClient.from(t).delete().eq('id',id); if(t==='staff')loadStaffList(); else loadAdminList(); } }

    // --- REVIEWS & MESSAGES ---
    let notif=false,sound=true;
    window.toggleNotifSetting=()=>{ notif=!notif; document.getElementById('notif-state').innerText=notif?'ON':'OFF'; document.getElementById('sound-btn').style.display=notif?'flex':'none'; }
    window.toggleSoundSetting=()=>{ sound=!sound; document.getElementById('sound-state').innerText=sound?'ON':'OFF'; if(sound)document.getElementById('notif-sound').play(); }
    async function loadReviews(){ const {data}=await supabaseClient.from('reviews').select('*'); const c=document.getElementById('reviews-container'); c.innerHTML=''; if(data)data.forEach(r=>{ c.innerHTML+=`<div class="clean-table" style="margin-bottom:10px;padding:15px;"><strong>${r.customer_name}</strong> (${r.rating} stars)<p style="margin:5px 0 0 0;color:#666;">${r.comment}</p></div>`; }); }
    async function loadMessages(){ const {data}=await supabaseClient.from('messages').select('*'); const c=document.getElementById('messages-container'); c.innerHTML=''; if(data)data.forEach(m=>{ c.innerHTML+=`<div style="padding:10px;border-bottom:1px solid #eee;"><b>${m.title}</b>: ${m.body}</div>`; }); }

    // --- DISCOUNTS ---
    let editingDiscountId = null;
    let reportInterval = null;

    // Filter State
    let discountFilters = {
        status: 'all', // all, active, inactive, expired
        usage: 'all',  // all, single, multi
        scope: 'all',  // all, public, private
        dateStart: null,
        dateEnd: null,
        amount: null,
        amountOp: 'gt'
    };

    // --- DROPDOWN LOGIC ---
    window.togglePillMenu = function(id) {
        document.querySelectorAll('.pill-menu').forEach(m => {
            if(m.id !== 'menu-'+id) m.classList.remove('show');
        });
        document.getElementById('menu-'+id).classList.toggle('show');
    }

    // Set Filter from Dropdown
    window.setDiscountFilter = function(type, value, label) {
        discountFilters[type] = value;
        document.getElementById(`label-${type}`).innerText = `${type.charAt(0).toUpperCase() + type.slice(1)}: ${label}`;
        document.getElementById(`menu-${type}`).classList.remove('show');
        
        // Handle visual selection
        document.querySelectorAll(`#menu-${type} .pill-option`).forEach(opt => {
            if(opt.innerText === label) opt.classList.add('selected');
            else opt.classList.remove('selected');
        });

        // Ensure "All" button is inactive if filters are active
        const btnAll = document.getElementById('btn-all-discounts');
        const anyActive = (discountFilters.status !== 'all' || discountFilters.usage !== 'all' || discountFilters.scope !== 'all');
        if(anyActive) btnAll.classList.remove('active-tab');
        
        loadDiscounts();
    }

    window.resetAllDiscountFilters = function(el) {
        discountFilters.status = 'all';
        discountFilters.usage = 'all';
        discountFilters.scope = 'all';
        
        // Reset Dropdown Text & Selection
        ['status', 'usage', 'scope'].forEach(type => {
            document.getElementById(`label-${type}`).innerText = `${type.charAt(0).toUpperCase() + type.slice(1)}: All`;
            document.querySelectorAll(`#menu-${type} .pill-option`).forEach(opt => {
                if(opt.innerText === 'All') opt.classList.add('selected');
                else opt.classList.remove('selected');
            });
        });

        el.classList.add('active-tab');
        loadDiscounts();
    }

    window.applyAdvancedFilters = function() {
        discountFilters.dateStart = document.getElementById('filter-date-start').value;
        discountFilters.dateEnd = document.getElementById('filter-date-end').value;
        discountFilters.amount = document.getElementById('filter-amount').value;
        discountFilters.amountOp = document.getElementById('filter-amount-op').value;
        loadDiscounts();
    }

    window.resetAdvancedFilters = function() {
        document.getElementById('filter-date-start').value = '';
        document.getElementById('filter-date-end').value = '';
        document.getElementById('filter-amount').value = '';
        discountFilters.dateStart = null;
        discountFilters.dateEnd = null;
        discountFilters.amount = null;
        loadDiscounts();
    }

    window.loadDiscounts = async function() {
        let {data, error} = await supabaseClient.from('discounts').select('*').order('created_at', {ascending: false});
        if(!data) return;

        const container = document.getElementById('discount-list');
        container.innerHTML = '';
        const now = new Date();

        // CLIENT SIDE FILTERING (MULTI-DIMENSIONAL)
        const filteredData = data.filter(d => {
            const isExpired = new Date(d.valid_to) < now;
            const isInactive = d.status === 'inactive';
            const isActive = !isExpired && !isInactive;

            if (discountFilters.status === 'active' && !isActive) return false;
            if (discountFilters.status === 'inactive' && !isInactive) return false;
            if (discountFilters.status === 'expired' && (!isExpired || isInactive)) return false;

            if (discountFilters.usage === 'single' && d.usage_type !== 'single') return false;
            if (discountFilters.usage === 'multi' && d.usage_type !== 'multi') return false;

            if (discountFilters.scope === 'public' && d.type !== 'public') return false;
            if (discountFilters.scope === 'private' && d.type !== 'private') return false;

            if (discountFilters.dateStart) {
                if (new Date(d.created_at) < new Date(discountFilters.dateStart)) return false;
            }
            if (discountFilters.dateEnd) {
                let endDate = new Date(discountFilters.dateEnd);
                endDate.setDate(endDate.getDate() + 1);
                if (new Date(d.created_at) >= endDate) return false;
            }

            if (discountFilters.amount) {
                const val = parseFloat(discountFilters.amount);
                if (discountFilters.amountOp === 'gt') {
                    if (d.min_order_amount <= val) return false;
                } else {
                    if (d.min_order_amount >= val) return false;
                }
            }
            return true;
        });

        if(filteredData.length === 0) {
            container.innerHTML = '<div style="padding:15px; color:#888;">No discounts found.</div>';
            return;
        }

        filteredData.forEach(d => {
            let isExpired = new Date(d.valid_to) < now;
            let statusText = d.status === 'inactive' ? 'Inactive' : (isExpired ? 'Expired' : 'Active');
            let statusClass = (d.status === 'inactive' || isExpired) ? 'status-inactive' : 'status-active';
            
            if(d.status === 'active' && isExpired) statusText = 'Expired';

            const div = document.createElement('div');
            div.className = 'table-row';
            const jsonD = JSON.stringify(d).replace(/"/g, '&quot;');
            
            div.innerHTML = `
                <span style="flex:2; font-weight:600;">${d.code}</span>
                <span style="flex:1; font-size:12px;">${d.type.toUpperCase()}</span>
                <span style="flex:1; font-size:12px;">${d.usage_type === 'single' ? 'Single Use' : 'Multi Use'}</span>
                <span style="flex:1; font-size:12px;">$${d.min_order_amount}</span>
                <span style="flex:1;">
                    <span class="badge-status ${statusClass}" style="cursor: default;">${statusText}</span>
                </span>
                <span style="flex:1; text-align:right; display:flex; justify-content:flex-end; gap:10px;">
                        <button onclick="viewDiscountReport(${jsonD})" style="background:none; border:none; color:#3498DB; cursor:pointer;" title="Report"><i class="ri-eye-line"></i></button>
                        <button onclick="openDiscountModal(${jsonD})" style="background:none; border:none; color:#F39C12; cursor:pointer;" title="Edit"><i class="ri-pencil-line"></i></button>
                        <button onclick="deleteDiscount(${d.id})" style="background:none; border:none; color:#FF7675; cursor:pointer;" title="Delete"><i class="ri-delete-bin-line"></i></button>
                </span>
            `;
            container.appendChild(div);
        });
    }

    // --- ASYNC REPORT WITH TARGET COUNTING ---
    window.viewDiscountReport = async function(d) {
        const modal = document.getElementById('discount-report-modal');
        const content = document.getElementById('report-content');
        
        // 1. Time Percentage
        const now = new Date().getTime();
        const start = new Date(d.valid_from).getTime();
        const end = new Date(d.valid_to).getTime();
        const totalDuration = end - start;
        const elapsed = now - start;
        let timePerc = Math.min(100, Math.max(0, Math.round((elapsed / totalDuration) * 100)));
        if(isNaN(timePerc)) timePerc = 0;

        // 2. Usage Percentage & Label Logic
        let usagePerc = 0;
        let usageLabel = `${d.usage_count}`;
        let subLabel = "Total Uses";

        if (d.type === 'private') {
            content.innerHTML = '<p>Loading report data...</p>';
            modal.style.display = 'flex';
            
            const { count, error } = await supabaseClient
                .from('discount_targets')
                .select('*', { count: 'exact', head: true })
                .eq('discount_id', d.id);
            
            const targetCount = count || 0;
            
            if (targetCount > 0) {
                usagePerc = Math.min(100, Math.round((d.usage_count / targetCount) * 100));
                usageLabel = `${d.usage_count} / ${targetCount}`;
                subLabel = "Used / Targets";
            } else {
                usagePerc = 0;
                usageLabel = "0 / 0";
            }
        } else {
            // Public Code
            if (d.usage_limit && d.usage_limit > 0 && d.usage_type === 'multi') {
                usagePerc = 100; 
                usageLabel = `${d.usage_count}`;
                subLabel = "Public Uses";
            } else {
                usagePerc = 100;
                usageLabel = `${d.usage_count}`;
                subLabel = "Public Uses";
            }
        }

        // Render Report
        content.innerHTML = `
            <div style="font-size:18px; font-weight:700; color:#333; margin-bottom:5px;">${d.code}</div>
            <div style="color:#888; font-size:12px; margin-bottom:20px;">${d.type.toUpperCase()} - ${d.usage_type.toUpperCase()}</div>
            
            <div class="report-grid">
                <!-- Time Circle -->
                <div class="report-item">
                    <div class="report-circle" style="background: conic-gradient(${timePerc < 100 ? '#FF724C' : '#aaa'} ${timePerc}%, #eee 0% 100%);">
                        <span class="report-val">${timePerc}%</span>
                    </div>
                    <div class="report-label">Time Elapsed</div>
                </div>

                <!-- Usage Circle -->
                <div class="report-item">
                    <div class="report-circle" style="background: conic-gradient(#3498DB ${usagePerc}%, #eee 0% 100%);">
                        <span class="report-val">${usagePerc}%</span>
                    </div>
                    <div class="report-label">Usage Rate</div>
                    <div class="report-subval">${usageLabel}</div>
                    <div style="font-size:10px; color:#aaa;">${subLabel}</div>
                </div>
            </div>

            <div class="clean-table" style="padding:15px; text-align:left;">
                <div class="report-info-row"><span>Total Global Uses</span> <b>${d.usage_count}</b></div>
                <div class="report-info-row"><span>User Limit</span> <b>${d.usage_type === 'single' ? '1 per user' : (d.usage_limit||'∞') + ' per user'}</b></div>
                <div class="report-info-row"><span>Min Order</span> <b>$${d.min_order_amount}</b></div>
                <div class="report-info-row"><span>Time Left</span> <b id="countdown-timer">Calculating...</b></div>
                <div class="report-info-row"><span>Status</span> <b style="color:${d.status==='active'?'#2ECC71':'#FF7675'}">${d.status.toUpperCase()}</b></div>
            </div>
        `;
        
        modal.style.display = 'flex';

        // Timer Logic
        if(reportInterval) clearInterval(reportInterval);
        const endTime = new Date(d.valid_to).getTime();

        const updateTimer = () => {
            const now = new Date().getTime();
            const distance = endTime - now;

            if (distance < 0) {
                const timerEl = document.getElementById("countdown-timer");
                if(timerEl) timerEl.innerHTML = "Expired";
                clearInterval(reportInterval);
            } else {
                const days = Math.floor(distance / (1000 * 60 * 60 * 24));
                const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
                const timerEl = document.getElementById("countdown-timer");
                if(timerEl) timerEl.innerHTML = `${days}d ${hours}h ${minutes}m`;
            }
        };
        updateTimer();
        reportInterval = setInterval(updateTimer, 1000);
    }

    window.closeReportModal = function() {
        if(reportInterval) clearInterval(reportInterval);
        document.getElementById('discount-report-modal').style.display='none';
    }

    // Close Modal when clicking outside
    document.getElementById('discount-modal').addEventListener('click', function(e) {
        if (e.target === this) this.style.display = 'none';
    });
    document.getElementById('discount-report-modal').addEventListener('click', function(e) {
        if (e.target === this) closeReportModal();
    });
    // Close dropdowns when clicking outside
    window.onclick = function(e) {
        if (!e.target.closest('.chip-dropdown') && !e.target.closest('.pill-dropdown')) {
            document.querySelectorAll('.chip-menu, .pill-menu').forEach(m => m.classList.remove('show'));
        }
    }

    window.openDiscountModal = function(editData = null) {
        editingDiscountId = null;
        document.getElementById('modal-title').innerText = "Create Discount Code";
        document.getElementById('save-disc-btn').innerText = "Create Discount";
        
        // Reset Inputs
        document.getElementById('disc-percent').value = ''; 
        document.getElementById('disc-code-name').value = '';
        document.getElementById('disc-usage-limit').value = '';
        document.getElementById('disc-min-order').value = '0';
        document.getElementById('target-users-list').innerHTML = '<div style="text-align:center; color:#aaa; font-size:12px;">Select a filter to find users</div>';
        
        // Default Radios
        document.querySelector('input[name="disc-scope"][value="public"]').checked = true;
        document.querySelector('input[name="disc-usage"][value="single"]').checked = true;
        document.querySelector('input[name="disc-time"][value="daily"]').checked = true;
        document.querySelector('input[name="disc-status"][value="active"]').checked = true; 

        if(editData) {
            editingDiscountId = editData.id;
            document.getElementById('modal-title').innerText = "Edit Discount Code";
            document.getElementById('save-disc-btn').innerText = "Update Discount";
            
            // Fill Inputs
            document.getElementById('disc-percent').value = editData.percentage || ''; 
            document.getElementById('disc-code-name').value = editData.code;
            document.getElementById('disc-min-order').value = editData.min_order_amount;
            
            // Radios
            document.querySelector(`input[name="disc-scope"][value="${editData.type}"]`).checked = true;
            document.querySelector(`input[name="disc-usage"][value="${editData.usage_type}"]`).checked = true;
            document.querySelector(`input[name="disc-status"][value="${editData.status}"]`).checked = true; 
            
            if(editData.usage_type === 'multi') document.getElementById('disc-usage-limit').value = editData.usage_limit;

            const start = new Date(editData.valid_from);
            const end = new Date(editData.valid_to);
            
            document.getElementById('disc-start-date').value = start.toISOString().split('T')[0];
            document.getElementById('disc-end-date').value = end.toISOString().split('T')[0];
            
            // Populate hourly fields
            document.getElementById('disc-hourly-start-date').value = start.toISOString().split('T')[0];
            document.getElementById('disc-start-time').value = start.toTimeString().slice(0,5);
            document.getElementById('disc-hourly-end-date').value = end.toISOString().split('T')[0];
            document.getElementById('disc-end-time').value = end.toTimeString().slice(0,5);
        } else {
            const today = new Date().toISOString().split('T')[0];
            const nowTime = new Date().toTimeString().slice(0,5);
            
            document.getElementById('disc-start-date').value = today;
            document.getElementById('disc-end-date').value = today;
            
            document.getElementById('disc-hourly-start-date').value = today;
            document.getElementById('disc-hourly-end-date').value = today;
            document.getElementById('disc-start-time').value = nowTime;
            document.getElementById('disc-end-time').value = "23:59";
        }
        toggleDiscScope(); toggleUsageInput(); toggleTimeInputs();
        document.getElementById('discount-modal').style.display = 'flex';
    }

    window.toggleDiscScope = function() {
        const isPrivate = document.querySelector('input[name="disc-scope"]:checked').value === 'private';
        document.getElementById('private-filters').style.display = isPrivate ? 'block' : 'none';
    }
    window.toggleUsageInput = function() {
        const isMulti = document.querySelector('input[name="disc-usage"]:checked').value === 'multi';
        document.getElementById('disc-usage-limit').style.display = isMulti ? 'block' : 'none';
    }
    window.toggleTimeInputs = function() {
        const isDaily = document.querySelector('input[name="disc-time"]:checked').value === 'daily';
        document.getElementById('time-daily').style.display = isDaily ? 'block' : 'none';
        document.getElementById('time-hourly').style.display = isDaily ? 'none' : 'block';
    }
    window.updateFilterInputs = function() {
        const type = document.getElementById('disc-filter-type').value;
        const inputContainer = document.getElementById('filter-input-container');
        inputContainer.style.display = (type !== 'none' && type !== 'inactive') ? 'block' : 'none';
        document.getElementById('disc-filter-val').value = '';
    }
    window.applyDiscountFilter = async function() {
        const filterType = document.getElementById('disc-filter-type').value;
        const filterVal = document.getElementById('disc-filter-val').value.toLowerCase().trim();
        const listContainer = document.getElementById('target-users-list');
        listContainer.innerHTML = 'Loading...';
        let customers = [];
        const { data: allCusts } = await supabaseClient.from('customers').select('id, name, phone, created_at');
        if (!allCusts) { listContainer.innerHTML = 'No customers found.'; return; }
        
        if (filterType === 'inactive') {
            const { data: orders } = await supabaseClient.from('orders').select('customer_id, created_at').order('created_at', {ascending: false});
            customers = allCusts.filter(c => {
                const userOrders = orders.filter(o => o.customer_id === c.id);
                if (userOrders.length === 0) return true; 
                const diffDays = Math.ceil(Math.abs(new Date() - new Date(userOrders[0].created_at)) / (1000 * 60 * 60 * 24)); 
                return diffDays > 30; 
            });
        } else if (filterType === 'name') customers = allCusts.filter(c => c.name.toLowerCase().includes(filterVal));
        else if (filterType === 'phone_start') customers = allCusts.filter(c => c.phone && c.phone.startsWith(filterVal));
        else if (filterType === 'phone_end') customers = allCusts.filter(c => c.phone && c.phone.endsWith(filterVal));
        else if (filterType === 'spender') {
            const minAmount = parseFloat(filterVal); if(isNaN(minAmount)) { alert("Invalid amount"); return; }
            const { data: orders } = await supabaseClient.from('orders').select('customer_id, total_amount');
            const spenderIds = new Set(); orders.forEach(o => { if(o.total_amount >= minAmount) spenderIds.add(o.customer_id); });
            customers = allCusts.filter(c => spenderIds.has(c.id));
        }
        listContainer.innerHTML = '';
        if(customers.length === 0) listContainer.innerHTML = '<div style="padding:5px;">No matching customers found.</div>';
        else {
            const allDiv = document.createElement('div'); allDiv.className = 'user-checkbox-item';
            allDiv.innerHTML = `<input type="checkbox" id="select-all-users" onchange="document.querySelectorAll('.target-user-cb').forEach(cb => cb.checked = this.checked)"> <b>Select All (${customers.length})</b>`;
            listContainer.appendChild(allDiv);
            customers.forEach(c => { const item = document.createElement('div'); item.className = 'user-checkbox-item'; item.innerHTML = `<input type="checkbox" class="target-user-cb" value="${c.id}"> ${c.name} (${c.phone || '-'})`; listContainer.appendChild(item); });
        }
    }

    window.saveDiscount = async function() {
        const percentage = parseFloat(document.getElementById('disc-percent').value);
        const code = document.getElementById('disc-code-name').value.trim();
        const scope = document.querySelector('input[name="disc-scope"]:checked').value;
        const usageType = document.querySelector('input[name="disc-usage"]:checked').value;
        const timeType = document.querySelector('input[name="disc-time"]:checked').value;
        const status = document.querySelector('input[name="disc-status"]:checked').value;
        const minOrder = parseFloat(document.getElementById('disc-min-order').value) || 0;
        
        if (!percentage) return alert("Enter Discount Percentage.");
        if (!code) return alert("Enter Code Name.");
        
        let validFrom, validTo;
        if (timeType === 'daily') {
            const dStart = document.getElementById('disc-start-date').value; 
            const dEnd = document.getElementById('disc-end-date').value;
            if(!dStart || !dEnd) return alert("Select dates.");
            validFrom = new Date(dStart); 
            validTo = new Date(dEnd);
        } else {
            const dStart = document.getElementById('disc-hourly-start-date').value;
            const tStart = document.getElementById('disc-start-time').value; 
            const dEnd = document.getElementById('disc-hourly-end-date').value;
            const tEnd = document.getElementById('disc-end-time').value;
            
            if(!dStart || !tStart || !dEnd || !tEnd) return alert("Fill all hourly fields.");
            validFrom = new Date(`${dStart}T${tStart}`); 
            validTo = new Date(`${dEnd}T${tEnd}`);
            
            if(validTo <= validFrom) return alert("End time must be after Start time.");
        }

        let usageLimit = 1; 
        if(usageType === 'multi') {
            usageLimit = parseInt(document.getElementById('disc-usage-limit').value);
            if(!usageLimit || usageLimit < 1) return alert("Invalid usage limit.");
        }

        let targetIds = [];
        if (scope === 'private') {
            document.querySelectorAll('.target-user-cb:checked').forEach(cb => targetIds.push(cb.value));
            if(!editingDiscountId && targetIds.length === 0) return alert("Select at least one customer.");
        }

        const payload = { 
            percentage: percentage,
            code, 
            type: scope, 
            usage_type: usageType, 
            usage_limit: usageLimit, 
            valid_from: validFrom.toISOString(), 
            valid_to: validTo.toISOString(), 
            min_order_amount: minOrder, 
            status: status 
        };

        if(editingDiscountId) {
            await supabaseClient.from('discounts').update(payload).eq('id', editingDiscountId);
            if(scope === 'private' && targetIds.length > 0) {
                await supabaseClient.from('discount_targets').delete().eq('discount_id', editingDiscountId);
                await supabaseClient.from('discount_targets').insert(targetIds.map(uid => ({ discount_id: editingDiscountId, customer_id: uid })));
            }
            alert("Updated!");
        } else {
            const { data: discData, error: discError } = await supabaseClient.from('discounts').insert([payload]).select();
            if(discError) {
                console.error(discError);
                return alert("Error creating discount (Check DB columns/Code unique).");
            }
            const newDiscountId = discData[0].id;
            if(scope === 'private' && targetIds.length > 0) await supabaseClient.from('discount_targets').insert(targetIds.map(uid => ({ discount_id: newDiscountId, customer_id: uid })));
            alert("Created!");
        }
        document.getElementById('discount-modal').style.display = 'none';
        loadDiscounts();
    }

    window.deleteDiscount = async function(id) {
        if(confirm("Delete permanently?")) { await supabaseClient.from('discounts').delete().eq('id', id); loadDiscounts(); }
    }
    
    // --- MODAL & CHIPS (Updated Logic) ---
    document.getElementById('profile-trigger').onclick = () => {
        document.getElementById('profile-modal').style.display = 'flex';
        // Pre-fill current username for convenience (Logic)
        document.getElementById('edit-self-user').value = document.getElementById('header-username').innerText;
    };
    
    // 1. EDIT PROFILE LOGIC
    document.getElementById('save-profile-btn').onclick = async () => {
        const u = document.getElementById('edit-self-user').value.trim();
        const p = document.getElementById('edit-self-pass').value.trim();
        const ph = document.getElementById('edit-self-phone').value.trim();
        const em = document.getElementById('edit-self-email').value.trim();
        const currentName = document.getElementById('header-username').innerText;

        // Validation: All fields mandatory
        if (!u || !p || !ph || !em) return alert("All fields (Username, Password, Phone, Email) are mandatory.");

        // Update Supabase
        const { error } = await supabaseClient.from('admins')
            .update({ username: u, password: p, phone: ph, email: em })
            .eq('username', currentName); // Assuming we identify by current username session

        if (error) {
            console.error(error);
            alert("Error updating profile: " + error.message);
        } else {
            alert("Profile updated successfully! Please login again.");
            window.location.href = 'login.html';
        }
    };

    // 2. CREATE NEW ADMIN LOGIC (Inside Modal)
    document.getElementById('modal-create-admin-btn').onclick = async () => {
        const newU = document.getElementById('modal-new-admin-user').value.trim();
        const newP = document.getElementById('modal-new-admin-pass').value.trim();

        // Validation: Mandatory fields
        if (!newU || !newP) return alert("Username and Password are required for new admin.");

        // Insert into Supabase
        const { error } = await supabaseClient.from('admins').insert([{ username: newU, password: newP }]);

        if (error) {
            console.error(error);
            alert("Error creating admin: " + error.message);
        } else {
            alert("New Admin Created Successfully!");
            // Clear inputs
            document.getElementById('modal-new-admin-user').value = '';
            document.getElementById('modal-new-admin-pass').value = '';
            // Refresh admin list if user is currently viewing the Users tab
            if(document.getElementById('user-tab-admin').style.display === 'block') loadAdminList();
        }
    };

    window.toggleChip=(id)=>{ document.querySelectorAll('.chip-menu').forEach(m=>m.classList.remove('show')); document.getElementById('menu-'+id).classList.add('show'); };
    const ts=Array.from({length:24},(_,i)=>`${i.toString().padStart(2,'0')}:00`); const ds=['Mon','Tue','Wed','Thu','Fri','Sat','Sun']; ['start-time','end-time'].forEach(t=>fillM(t,ts)); ['start-day','end-day'].forEach(t=>fillM(t,ds));
    function fillM(id,arr){ const m=document.getElementById('menu-'+id); arr.forEach(v=>{ const d=document.createElement('div'); d.className='chip-option'; d.innerText=v; d.onclick=()=>{ document.querySelector(`#chip-${id} .val`).innerText=v; m.classList.remove('show'); }; m.appendChild(d); }); }
});
