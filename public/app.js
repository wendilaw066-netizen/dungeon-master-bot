document.addEventListener('DOMContentLoaded', () => {
  const loginOverlay = document.getElementById('loginOverlay');
  const dashboardLayout = document.getElementById('dashboardLayout');
  const loginBtn = document.getElementById('loginBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  const passwordInput = document.getElementById('passwordInput');
  const loginError = document.getElementById('loginError');
  const liveClock = document.getElementById('liveClock');

  let ownerPassword = localStorage.getItem('zhu_owner_password');
  let playersData = [];

  // Clock
  setInterval(() => {
    liveClock.textContent = new Date().toLocaleTimeString('en-US', { hour12: false });
  }, 1000);

  // Authentication
  const checkAuth = async () => {
    if (!ownerPassword) {
      showLogin();
      return;
    }
    try {
      const res = await fetch('/api/players', {
        headers: { 'x-owner-password': ownerPassword }
      });
      if (res.ok) {
        const data = await res.json();
        playersData = data.players;
        renderDashboard(data);
        hideLogin();
      } else {
        showLogin('Session expired or invalid password.');
        localStorage.removeItem('zhu_owner_password');
      }
    } catch (err) {
      showLogin('Connection error.');
    }
  };

  loginBtn.addEventListener('click', async () => {
    const pass = passwordInput.value;
    if (!pass) return;
    try {
      const res = await fetch('/api/players', {
        headers: { 'x-owner-password': pass }
      });
      if (res.ok) {
        ownerPassword = pass;
        localStorage.setItem('zhu_owner_password', pass);
        const data = await res.json();
        playersData = data.players;
        renderDashboard(data);
        hideLogin();
      } else {
        loginError.textContent = 'Invalid password.';
      }
    } catch (err) {
      loginError.textContent = 'Connection error.';
    }
  });

  logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('zhu_owner_password');
    ownerPassword = null;
    showLogin();
  });

  function showLogin(msg = '') {
    loginOverlay.style.display = 'flex';
    dashboardLayout.style.display = 'none';
    loginError.textContent = msg;
    passwordInput.value = '';
  }

  function hideLogin() {
    loginOverlay.style.display = 'none';
    dashboardLayout.style.display = 'flex';
  }

  // Navigation
  const navBtns = document.querySelectorAll('.nav-btn');
  const sections = document.querySelectorAll('.content-section');

  navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      navBtns.forEach(b => b.classList.remove('active'));
      sections.forEach(s => s.classList.remove('active'));
      
      btn.classList.add('active');
      document.getElementById(btn.dataset.target).classList.add('active');
    });
  });

  // Rendering
  function renderDashboard(data) {
    document.getElementById('totalWlVal').textContent = data.summary.totalWl.toLocaleString();
    document.getElementById('totalPlayersVal').textContent = data.total;
    document.getElementById('topWlVal').textContent = data.summary.topPlayerWl.toLocaleString();

    renderFactionStats(data.players);
    renderTable(data.players);
  }

  function renderFactionStats(players) {
    const factions = { Shu: 0, Wei: 0, Wu: 0, Neutral: 0 };
    players.forEach(p => {
      // Simulate faction from town data or use default if missing
      // (Requires backend to send faction, assuming backend sends it or inferring)
      const faction = p.faction || 'Neutral';
      if (factions[faction] !== undefined) factions[faction]++;
    });

    const icons = { Shu: '🐉', Wei: '🦅', Wu: '🐅', Neutral: '⚔️' };
    const html = Object.keys(factions).map(f => `
      <div class="faction-item">
        <div class="faction-icon">${icons[f]}</div>
        <div>
          <div class="label" style="color:var(--text-muted); font-size:0.8rem; text-transform:uppercase;">${f} Faction</div>
          <div class="value" style="font-size:1.5rem; font-weight:600;">${factions[f]} Govs</div>
        </div>
      </div>
    `).join('');
    document.getElementById('factionStats').innerHTML = html;
  }

  function renderTable(players) {
    const search = document.getElementById('searchInput').value.toLowerCase();
    const filter = document.getElementById('factionFilter').value;

    const filtered = players.filter(p => {
      const matchSearch = p.name.toLowerCase().includes(search) || p.userId.includes(search);
      const pFaction = p.faction || 'Neutral';
      const matchFaction = filter === 'all' || pFaction === filter;
      return matchSearch && matchFaction;
    });

    const tbody = document.getElementById('playerTableBody');
    tbody.innerHTML = filtered.map(p => {
      const pFaction = p.faction || 'Neutral';
      const wlStr = p.coins > 1000 ? (p.coins/1000).toFixed(1) + 'k' : p.coins;
      
      let militaryInfo = 'None';
      if (p.town) {
        militaryInfo = `Tier ${p.town.tier}`;
      }

      return `
        <tr>
          <td>
            <div class="player-name">${p.name}</div>
            <div style="font-size:0.75rem; color:var(--text-muted)">ID: ${p.userId}</div>
          </td>
          <td><span class="faction-badge faction-${pFaction}">${pFaction}</span></td>
          <td><span class="text-gold">${wlStr} Coins</span></td>
          <td>${militaryInfo}</td>
          <td>
            <div style="font-size: 0.8rem; line-height: 1.2;">
              Infantry: ${p.army?.infantry || 0}<br>
              Archers: ${p.army?.archers || 0}<br>
              Cavalry: ${p.army?.cavalry || 0}<br>
              Spearmen: ${p.army?.spearmen || 0}<br>
              Catapults: ${p.army?.catapults || 0}
            </div>
          </td>
          <td>${p.lastActive}</td>
          <td>
            <button class="btn-primary btn-small" onclick="openEditModal('${p.userId}')" style="margin-bottom:0.5rem; display:block; width:100%;">Edit</button>
            <button class="btn-secondary btn-small" onclick="jailPlayer('${p.userId}')" style="display:block; width:100%;">Jail</button>
          </td>
        </tr>
      `;
    }).join('');
  }

  document.getElementById('searchInput').addEventListener('input', () => renderTable(playersData));
  document.getElementById('factionFilter').addEventListener('change', () => renderTable(playersData));

  // Edit Player logic
  window.openEditModal = (userId) => {
    const player = playersData.find(p => p.userId === userId);
    if (!player) return;
    
    document.getElementById('editUserId').value = userId;
    document.getElementById('editPlayerName').textContent = `${player.name} (${userId})`;
    
    document.getElementById('editCoins').value = player.coins || 0;
    
    
    document.getElementById('editGems').value = player.gems || 0;
    
    document.getElementById('editInfantry').value = player.army?.infantry || 0;
    document.getElementById('editArchers').value = player.army?.archers || 0;
    document.getElementById('editCavalry').value = player.army?.cavalry || 0;
    document.getElementById('editSpearmen').value = player.army?.spearmen || 0;
    document.getElementById('editCatapults').value = player.army?.catapults || 0;

    document.getElementById('editModal').style.display = 'flex';
  };

  window.closeEditModal = () => {
    document.getElementById('editModal').style.display = 'none';
  };

  window.savePlayerEdit = async () => {
    const userId = document.getElementById('editUserId').value;
    const payload = {
      action: 'edit_player',
      userId,
      coins: parseInt(document.getElementById('editCoins').value) || 0,      gems: parseInt(document.getElementById('editGems').value) || 0,
      army: {
        infantry: parseInt(document.getElementById('editInfantry').value) || 0,
        archers: parseInt(document.getElementById('editArchers').value) || 0,
        cavalry: parseInt(document.getElementById('editCavalry').value) || 0,
        spearmen: parseInt(document.getElementById('editSpearmen').value) || 0,
        catapults: parseInt(document.getElementById('editCatapults').value) || 0,
      }
    };

    try {
      const res = await fetch('/api/control', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-owner-password': ownerPassword
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      alert(data.message);
      if (data.success) {
        closeEditModal();
        checkAuth(); // Refresh table data
      }
    } catch (err) {
      alert('Error saving player.');
    }
  };

  window.jailPlayer = async (userId) => {
    const mins = prompt('Jail for how many minutes?', '10');
    if (!mins) return;
    try {
      const res = await fetch('/api/control', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-owner-password': ownerPassword
        },
        body: JSON.stringify({ action: 'jail', userId, minutes: parseInt(mins) })
      });
      const data = await res.json();
      alert(data.message);
      checkAuth(); // Refresh data
    } catch (err) {
      alert('Error jailing player.');
    }
  };

  window.triggerEvent = async () => {
    const eventType = document.getElementById('eventType').value;
    try {
      const res = await fetch('/api/control', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-owner-password': ownerPassword
        },
        body: JSON.stringify({ action: 'trigger_event', eventType })
      });
      const data = await res.json();
      alert(data.message);
    } catch (err) {
      alert('Error triggering event.');
    }
  };

  window.spawnBoss = async () => {
    const bossName = document.getElementById('bossName').value;
    const bossHp = document.getElementById('bossHp').value;
    if (!bossName || !bossHp) {
      alert('Please fill out boss name and HP.');
      return;
    }
    try {
      const res = await fetch('/api/control', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-owner-password': ownerPassword
        },
        body: JSON.stringify({ action: 'spawn_boss', bossName, bossHp: parseInt(bossHp) })
      });
      const data = await res.json();
      alert(data.message);
    } catch (err) {
      alert('Error spawning boss.');
    }
  };

  window.sendAnnouncement = async () => {
    const text = document.getElementById('announceText').value;
    if (!text) return;
    try {
      const res = await fetch('/api/control', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-owner-password': ownerPassword
        },
        body: JSON.stringify({ action: 'announce', text })
      });
      const data = await res.json();
      alert(data.message);
      document.getElementById('announceText').value = '';
    } catch (err) {
      alert('Error sending announcement.');
    }
  };

  // Initial load
  checkAuth();
  setInterval(checkAuth, 30000); // Auto refresh every 30s
});
