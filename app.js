import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, onValue, set } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyD5YO3H_DYiitF4fJdpbWsGWKBDprPto_Y",
    databaseURL: "https://motor2-a75b1-default-rtdb.firebaseio.com"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const motorCurrentRef = ref(db, '/motor/current');
const motorCmdRef = ref(db, '/motor/command');

const maxHistoryPoints = 20;
const historyData = { timestamps: [], rpm: [], current: [], temperature: [], vibration: [] };
let activeChartType = 'rpm'; 
let modalChart = null;

const activeAlerts = { rpm: false, current: false, temperature: false, vibration: false };

const chartConfigs = {
    rpm: { title: 'ประวัติความเร็วรอบ (RPM Trend)', label: 'ความเร็วรอบ (RPM)', color: '#0ea5e9', bg: 'rgba(14, 165, 233, 0.1)' },
    current: { title: 'ประวัติกระแสไฟฟ้า (Current Trend)', label: 'กระแสไฟ (Ampere)', color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)' },
    temperature: { title: 'ประวัติอุณหภูมิมอเตอร์ (Temperature Trend)', label: 'อุณหภูมิ (°C)', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)' },
    vibration: { title: 'ประวัติแรงสั่นสะเทือน (Vibration Trend)', label: 'แรงสั่นสะเทือน (m/s²)', color: '#ec4899', bg: 'rgba(236, 72, 153, 0.1)' }
};

function addEventLog(type, message, severity) {
    const tbody = document.getElementById('log-tbody');
    const noLogRow = document.getElementById('no-log-row');
    if (noLogRow) noLogRow.remove();

    const now = new Date().toLocaleTimeString('th-TH');
    const badgeClass = severity === 'Critical' ? 'badge-danger' : 'badge-warning';

    const row = document.createElement('tr');
    row.innerHTML = `
        <td><strong>${now}</strong></td>
        <td>${type}</td>
        <td style="color: ${severity === 'Critical' ? '#ef4444' : '#f59e0b'}">${message}</td>
        <td><span class="badge ${badgeClass}">${severity}</span></td>
    `;
    tbody.insertBefore(row, tbody.firstChild);
}

onValue(motorCurrentRef, (snapshot) => {
    const data = snapshot.val();
    if (data) {
        const rpm = data.rpm !== undefined ? data.rpm : 0;
        const current = data.current !== undefined ? data.current : 0;
        const temp = data.temperature !== undefined ? data.temperature : 0;
        const vib = data.vibration !== undefined ? data.vibration : 0;

        document.getElementById('val-rpm').innerText = rpm.toFixed(1);
        document.getElementById('val-current').innerText = current.toFixed(2);
        document.getElementById('val-temp').innerText = temp !== 0 ? temp.toFixed(1) : 'N/A';
        document.getElementById('val-vib').innerText = vib !== 0 ? vib.toFixed(2) : 'N/A';
        document.getElementById('val-total').innerText = data.total !== undefined ? data.total : '0';
        
        let timeLabel = '';
        if (data.timestamp) {
            const date = new Date(data.timestamp * 1000);
            timeLabel = date.toLocaleTimeString('th-TH');
            document.getElementById('val-time').innerText = date.toLocaleString('th-TH');
        }

        if (timeLabel) {
            if (historyData.timestamps.length >= maxHistoryPoints) {
                historyData.timestamps.shift(); historyData.rpm.shift(); historyData.current.shift(); historyData.temperature.shift(); historyData.vibration.shift();
            }
            historyData.timestamps.push(timeLabel); historyData.rpm.push(rpm); historyData.current.push(current); historyData.temperature.push(temp); historyData.vibration.push(vib);
            if (modalChart && !document.getElementById('chart-modal').classList.contains('hidden')) { modalChart.update(); }
        }

        let isSystemCritical = false;

        // อ้างอิงตรวจสอบความปลอดภัยของข้อมูล
        const cardRpm = document.getElementById('card-rpm');
        if (rpm > 3000) {
            cardRpm.classList.add('bg-warning-alert');
            if (!activeAlerts.rpm) { addEventLog('RPM Overload', `ความเร็วรอบสูงผิดปกติ (${rpm.toFixed(0)} RPM)`, 'Warning'); activeAlerts.rpm = true; }
        } else { cardRpm.classList.remove('bg-warning-alert'); activeAlerts.rpm = false; }

        const cardCurrent = document.getElementById('card-current');
        if (current > 4.5) {
            cardCurrent.classList.add('bg-danger-alert'); isSystemCritical = true;
            if (!activeAlerts.current) { addEventLog('Overcurrent', `กระแสไฟฟ้าสูงเกินเกณฑ์ความปลอดภัย (${current.toFixed(2)} A)`, 'Critical'); activeAlerts.current = true; }
        } else { cardCurrent.classList.remove('bg-danger-alert'); activeAlerts.current = false; }

        const cardTemp = document.getElementById('card-temp');
        if (temp > 65) {
            cardTemp.classList.add('bg-danger-alert'); isSystemCritical = true;
            if (!activeAlerts.temperature) { addEventLog('Overheat', `มอเตอร์ร้อนเกินพิกัดวิกฤต (${temp.toFixed(1)} °C)`, 'Critical'); activeAlerts.temperature = true; }
        } else { cardTemp.classList.remove('bg-danger-alert'); activeAlerts.temperature = false; }

        const cardVib = document.getElementById('card-vib');
        if (vib > 2.5) {
            cardVib.classList.add('bg-warning-alert');
            if (!activeAlerts.vibration) { addEventLog('High Vibration', `ตรวจพบการสั่นสะเทือนรุนแรง (${vib.toFixed(2)} m/s²)`, 'Warning'); activeAlerts.vibration = true; }
        } else { cardVib.classList.remove('bg-warning-alert'); activeAlerts.vibration = false; }

        // 🌟 ปรับแต่งการแจ้งเตือนที่ตัวโลโก้และข้อความใต้หัวข้อหลักตามแบบโมเดิร์น
        const statusText = document.getElementById('system-status-text');
        const gearIcon = document.getElementById('system-gear-icon');
        
        if (isSystemCritical || activeAlerts.rpm || activeAlerts.vibration) {
            statusText.innerText = "⚠️ SYSTEM WARNING: ตรวจพบสภาวะการทำงานผิดปกติในระบบ!";
            statusText.className = "status-text-warning";
            gearIcon.className = "gear-icon status-gear-warning";
        } else {
            statusText.innerText = "🟢 ระบบทำงานปกติ (System Normal)";
            statusText.className = "status-text-normal";
            gearIcon.className = "gear-icon status-gear-normal";
        }
    }
});

const modalEl = document.getElementById('chart-modal');
const ctx = document.getElementById('modalChart').getContext('2d');

function initOrUpdateChart() {
    const config = chartConfigs[activeChartType];
    document.getElementById('modal-chart-title').innerText = config.title;
    if (modalChart) modalChart.destroy();
    modalChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: historyData.timestamps,
            datasets: [{ label: config.label, data: historyData[activeChartType], borderColor: config.color, backgroundColor: config.bg, borderWidth: 3, pointRadius: 4, tension: 0.2, fill: true }]
        },
        options: { responsive: true, maintainAspectRatio: false, scales: { x: { ticks: { color: '#9ca3af' } }, y: { ticks: { color: '#9ca3af' } } }, plugins: { legend: { labels: { color: '#f3f4f6' } } } }
    });
}

document.querySelectorAll('.card-clickable').forEach(card => {
    card.addEventListener('click', () => { activeChartType = card.getAttribute('data-type'); modalEl.classList.remove('hidden'); initOrUpdateChart(); });
});
document.getElementById('close-modal').addEventListener('click', () => modalEl.classList.add('hidden'));
window.addEventListener('click', (e) => { if (e.target === modalEl) modalEl.classList.add('hidden'); });

onValue(motorCmdRef, (snapshot) => {
    const cmd = snapshot.val();
    const statusEl = document.getElementById('motor-status');
    if (cmd === "ON") { statusEl.innerText = "เปิดทำงาน (ON)"; statusEl.className = "status-on"; }
    else if (cmd === "OFF") { statusEl.innerText = "ปิดทำงาน (OFF)"; statusEl.className = "status-off"; }
});
document.getElementById('btn-on').addEventListener('click', () => set(motorCmdRef, "ON").catch(err => console.error(err)));
document.getElementById('btn-off').addEventListener('click', () => set(motorCmdRef, "OFF").catch(err => console.error(err)));