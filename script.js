const form = document.getElementById("tabForm");
const tabList = document.getElementById("tabList");
const reminderBox = document.getElementById("reminderBox");
const searchInput = document.getElementById("search");
const filterSelect = document.getElementById("filter");

let tabs = JSON.parse(localStorage.getItem("tabs")) || [];

function saveTabs() {
    localStorage.setItem("tabs", JSON.stringify(tabs));
}

function renderTabs() {
    tabList.innerHTML = "";

    const searchText = searchInput.value.toLowerCase();
    const filter = filterSelect.value;

    tabs.forEach((tab, index) => {
        if (
            (filter !== "all" && tab.status !== filter) ||
            (!tab.reason.toLowerCase().includes(searchText) &&
             !tab.url.toLowerCase().includes(searchText))
        ) return;

        const li = document.createElement("li");
        if (tab.status === "done") li.classList.add("done");

        li.innerHTML = `
            <a href="${tab.url}" target="_blank">${tab.url}</a>
            <p>${tab.reason}</p>
            <small>${new Date(tab.createdAt).toLocaleString()}</small>
            <div class="actions">
                <button class="complete" onclick="toggleStatus(${index})">
                    ${tab.status === "pending" ? "Mark Done" : "Mark Pending"}
                </button>
                <button onclick="editTab(${index})">Edit</button>
                <button onclick="deleteTab(${index})">Delete</button>
            </div>
        `;

        tabList.appendChild(li);
    });
}

function deleteTab(index) {
    tabs.splice(index, 1);
    saveTabs();
    renderTabs();
}

function toggleStatus(index) {
    tabs[index].status =
        tabs[index].status === "pending" ? "done" : "pending";
    saveTabs();
    renderTabs();
}

function editTab(index) {
    const newReason = prompt("Edit reason:", tabs[index].reason);
    if (newReason && newReason.trim() !== "") {
        tabs[index].reason = newReason.trim();
        saveTabs();
        renderTabs();
    }
}

function checkReminders() {
    const now = Date.now();

    const dueTabs = tabs.filter(tab =>
        tab.remindAt &&
        tab.remindAt <= now &&
        tab.status === "pending" &&
        !tab.notified
    );

    if (dueTabs.length === 0) {
        reminderBox.style.display = "none";
        return;
    }

    reminderBox.style.display = "block";
    reminderBox.innerHTML = `
        <strong>Reminder</strong><br>
        ${dueTabs.map(t => `• ${t.reason}`).join("<br>")}
    `;

    if (document.visibilityState === "visible") {
        alert(
            "Reminder:\n\n" +
            dueTabs.map(t => `${t.reason}\n${t.url}`).join("\n\n")
        );
    }

    dueTabs.forEach(tab => tab.notified = true);
    saveTabs();
}

form.addEventListener("submit", e => {
    e.preventDefault();

    const url = document.getElementById("url").value.trim();
    const reason = document.getElementById("reason").value.trim();
    const remindAfter = document.getElementById("remindAfter").value;

    if (!url || !reason) return;

    const tab = {
        url,
        reason,
        createdAt: Date.now(),
        status: "pending",
        remindAt: remindAfter ? Date.now() + remindAfter * 60000 : null,
        notified: false
    };

    tabs.push(tab);
    saveTabs();
    renderTabs();
    form.reset();
});

searchInput.addEventListener("input", renderTabs);
filterSelect.addEventListener("change", renderTabs);

renderTabs();
checkReminders();
setInterval(checkReminders, 60000);

const themeToggle = document.getElementById("themeToggle");
const savedTheme = localStorage.getItem("theme");

if (savedTheme === "light") {
    document.body.classList.add("light");
}

themeToggle.addEventListener("click", () => {
    document.body.classList.toggle("light");
    localStorage.setItem(
        "theme",
        document.body.classList.contains("light") ? "light" : "dark"
    );
});
