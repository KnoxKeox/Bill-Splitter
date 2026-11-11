// ---------- 1. Find the elements ----------
const card = document.querySelector(".card");

const modeSelect = document.getElementById("mode");
const equalBox = document.getElementById("equalBox");
const orderBox = document.getElementById("orderBox");
const orderList = document.getElementById("orderList");
const addPersonBtn = document.getElementById("addPersonBtn");
const shareModeSelect = document.getElementById("shareMode");
const payerSelect = document.getElementById("payer");

const totalInput = document.getElementById("total");
const peopleInput = document.getElementById("people");
const serviceInput = document.getElementById("service");
const vatInput = document.getElementById("vat");
const deliveryInput = document.getElementById("delivery");
const calcBtn = document.getElementById("calcBtn");
const resetBtn = document.getElementById("resetBtn");
const result = document.getElementById("result");

const shareButtons = document.getElementById("shareButtons");
const copyBtn = document.getElementById("copyBtn");
const whatsappBtn = document.getElementById("whatsappBtn");

const presetNote = document.getElementById("presetNote");

// The plain-text summary for WhatsApp (filled after each calculation)
let summaryText = "";

// Which preset is selected right now ("" means none)
let activePreset = "";

// The name we save our data under in the browser
const SAVE_KEY = "billSplitterData";

// ---------- 2. Helper functions ----------
function formatNaira(kobo) {
    const naira = kobo / 100;
    return (
        "₦" +
        naira.toLocaleString("en-NG", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        })
    );
}

function peopleText(count) {
    return count + (count === 1 ? " person" : " people");
}

// "1 person pays" / "2 people pay"
function peopleWhoPay(count) {
    return peopleText(count) + (count === 1 ? " pays" : " pay");
}

// Stops typed names from breaking our HTML
function escapeHTML(text) {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

// One line of the on-screen receipt
function row(label, kobo, extraClass) {
    return (
        '<div class="row ' +
        (extraClass || "") +
        '">' +
        "<span>" +
        label +
        "</span>" +
        "<span>" +
        formatNaira(kobo) +
        "</span></div>"
    );
}

// One line of the WhatsApp text, like "VAT: ₦1,875.00"
function textLine(label, kobo) {
    return label + ": " + formatNaira(kobo);
}

// Reads service, VAT and delivery boxes and works out each in kobo
function readExtras(billKobo) {
    return {
        service: Math.round((billKobo * Number(serviceInput.value)) / 100),
        vat: Math.round((billKobo * Number(vatInput.value)) / 100),
        delivery: Math.round(Number(deliveryInput.value) * 100),
    };
}

// The top part of the on-screen receipt
function receiptTop(billKobo, extras) {
    const grandTotal = billKobo + extras.service + extras.vat + extras.delivery;
    let html = row("Bill", billKobo);
    if (extras.service > 0) html += row("Service charge", extras.service);
    if (extras.vat > 0) html += row("VAT", extras.vat);
    if (extras.delivery > 0)
        html += row("Delivery / extra fee", extras.delivery);
    html += row("Grand total", grandTotal, "big");
    return html;
}

// The top part of the WhatsApp text (a list of lines)
function summaryTop(billKobo, extras) {
    const grandTotal = billKobo + extras.service + extras.vat + extras.delivery;
    const lines = ["*Bill split* 🧾", textLine("Bill", billKobo)];
    if (extras.service > 0)
        lines.push(textLine("Service charge", extras.service));
    if (extras.vat > 0) lines.push(textLine("VAT", extras.vat));
    if (extras.delivery > 0)
        lines.push(textLine("Delivery / extra fee", extras.delivery));
    lines.push("*" + textLine("Grand total", grandTotal) + "*");
    return lines;
}

// Splits an amount (in kobo) according to "weights" and makes sure
// the pieces add up EXACTLY to the amount.
function splitProportionally(amount, weights) {
    const totalWeight = weights.reduce(function (sum, w) {
        return sum + w;
    }, 0);

    // Everyone gets their share, rounded down
    const shares = weights.map(function (w) {
        return Math.floor((amount * w) / totalWeight);
    });

    // Hand out the leftover kobo one at a time
    const given = shares.reduce(function (sum, s) {
        return sum + s;
    }, 0);
    let leftover = amount - given;
    let i = 0;
    while (leftover > 0) {
        shares[i] += 1;
        leftover -= 1;
        i = (i + 1) % shares.length;
    }
    return shares;
}

// Show a successful result and reveal the share buttons
function showResult(html, lines) {
    result.innerHTML = html;
    summaryText = lines.join("\n");
    shareButtons.classList.remove("hidden");
}

// Show an error message and hide the share buttons
function showError(message) {
    result.textContent = message;
    summaryText = "";
    shareButtons.classList.add("hidden");
}

// Clear the old result and hide the share buttons
function resetResult() {
    result.innerHTML = "";
    summaryText = "";
    shareButtons.classList.add("hidden");
}

// ---------- 3. Saving and loading ----------
// Packs everything typed so far into one object and stores it
function saveState() {
    const rows = [];
    orderList.querySelectorAll(".person").forEach(function (personRow) {
        rows.push({
            name: personRow.querySelector(".name").value,
            amount: personRow.querySelector(".amount").value,
        });
    });

    const data = {
        mode: modeSelect.value,
        total: totalInput.value,
        people: peopleInput.value,
        service: serviceInput.value,
        vat: vatInput.value,
        delivery: deliveryInput.value,
        shareMode: shareModeSelect.value,
        payer: payerSelect.value,
        preset: activePreset,
        rows: rows,
    };

    try {
        localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    } catch (error) {
        // Saving is a bonus. If it fails, the app still works.
    }
}

// Puts saved data back on the page. Returns true if it found any.
function loadState() {
    let data;
    try {
        data = JSON.parse(localStorage.getItem(SAVE_KEY));
    } catch (error) {
        return false;
    }
    if (!data || !data.rows || data.rows.length === 0) return false;

    modeSelect.value = data.mode;
    totalInput.value = data.total;
    peopleInput.value = data.people;
    serviceInput.value = data.service;
    vatInput.value = data.vat;
    deliveryInput.value = data.delivery;
    shareModeSelect.value = data.shareMode;

    // Rebuild the person rows
    orderList.innerHTML = "";
    data.rows.forEach(function (saved) {
        addPersonRow();
        const lastRow = orderList.lastElementChild;
        lastRow.querySelector(".name").value = saved.name;
        lastRow.querySelector(".amount").value = saved.amount;
    });

    refreshPayerList();
    payerSelect.value = data.payer;
    if (payerSelect.selectedIndex === -1) payerSelect.value = "";

    applyMode();

    // Bring back the highlighted preset and its hint
    if (data.preset && presets[data.preset]) {
        setActiveChip(data.preset);
        presetNote.textContent = presets[data.preset].note;
        presetNote.classList.remove("hidden");
    }

    return true;
}

// ---------- 4. People rows and the "Who paid?" dropdown ----------
function refreshPayerList() {
    const chosen = payerSelect.value;
    let html = '<option value="">Not selected</option>';

    const personRows = orderList.querySelectorAll(".person");
    personRows.forEach(function (personRow, index) {
        const name =
            personRow.querySelector(".name").value.trim() ||
            "Person " + (index + 1);
        html +=
            '<option value="' + index + '">' + escapeHTML(name) + "</option>";
    });

    payerSelect.innerHTML = html;
    payerSelect.value = chosen;
    if (payerSelect.selectedIndex === -1) payerSelect.value = "";
}

function addPersonRow() {
    const number = orderList.children.length + 1;
    const div = document.createElement("div");
    div.className = "person";
    div.innerHTML =
        '<input class="name" type="text" placeholder="Person ' +
        number +
        '">' +
        '<input class="amount" type="number" inputmode="decimal" placeholder="Ordered ₦">' +
        '<button class="remove" type="button" aria-label="Remove person">✕</button>';
    orderList.appendChild(div);
    refreshPayerList();
}

// After removing someone, the "Person 1, Person 2..." hints need renumbering
function renumberPlaceholders() {
    orderList.querySelectorAll(".person").forEach(function (personRow, index) {
        personRow.querySelector(".name").placeholder = "Person " + (index + 1);
    });
}

orderList.addEventListener("input", refreshPayerList);

// One listener for ALL the ✕ buttons (current and future)
orderList.addEventListener("click", function (event) {
    if (!event.target.classList.contains("remove")) return;
    if (orderList.children.length <= 2) return; // keep at least 2 people

    event.target.parentElement.remove();
    payerSelect.value = ""; // positions changed, so clear the payer
    renumberPlaceholders();
    refreshPayerList();
    saveState();
});

addPersonBtn.addEventListener("click", function () {
    addPersonRow();
    saveState();
});

// ---------- 5. Switch between the two modes ----------
function applyMode() {
    const byOrder = modeSelect.value === "order";
    equalBox.classList.toggle("hidden", byOrder);
    orderBox.classList.toggle("hidden", !byOrder);
    resetResult();
}

// Changing the dropdown by hand means we've left the preset
modeSelect.addEventListener("change", function () {
    applyMode();
    setActiveChip("");
    presetNote.classList.add("hidden");
});

// ---------- 6. Nigerian presets ----------
const presets = {
    restaurant: {
        mode: "order",
        service: "10",
        vat: "7.5",
        delivery: "",
        shareMode: "order",
        note: "Restaurant: type each person's name and what they ordered. Service charge (10%) and VAT (7.5%) are filled in. Change them if your bill is different.",
    },
    bolt: {
        mode: "equal",
        service: "",
        vat: "",
        delivery: "",
        shareMode: "equal",
        note: "Shared Bolt: put the fare in Total bill and how many of you rode. Add any toll or tip in the extra fee box.",
    },
    light: {
        mode: "equal",
        service: "",
        vat: "",
        delivery: "",
        shareMode: "equal",
        note: "Compound light bill: put the total amount in Total bill and the number of flats sharing it.",
    },
};

// Remembers which preset is selected, and highlights its button
function setActiveChip(name) {
    activePreset = name;
    document.querySelectorAll(".chip").forEach(function (chip) {
        const isActive = chip.dataset.preset === name;
        chip.classList.toggle("active", isActive);
        chip.setAttribute("aria-pressed", isActive);
    });
}

function applyPreset(name) {
    const preset = presets[name];

    modeSelect.value = preset.mode;
    serviceInput.value = preset.service;
    vatInput.value = preset.vat;
    deliveryInput.value = preset.delivery;
    shareModeSelect.value = preset.shareMode;

    applyMode();
    setActiveChip(name);

    presetNote.textContent = preset.note;
    presetNote.classList.remove("hidden");

    saveState();
}

const chips = document.querySelectorAll(".chip");
chips.forEach(function (chip) {
    chip.addEventListener("click", function () {
        applyPreset(chip.dataset.preset);
    });
});

// ---------- 7. Calculating: equal split ----------
function calculateEqual() {
    const people = Number(peopleInput.value);
    const total = Number(totalInput.value);

    if (total <= 0 || people <= 0 || !Number.isInteger(people)) {
        showError("Please enter a total and a whole number of people.");
        return;
    }

    const billKobo = Math.round(total * 100);
    const extras = readExtras(billKobo);
    const grandTotal = billKobo + extras.service + extras.vat + extras.delivery;

    const baseShare = Math.floor(grandTotal / people);
    const leftover = grandTotal - baseShare * people;

    let html = receiptTop(billKobo, extras);
    const lines = summaryTop(billKobo, extras);
    lines.push("");

    if (leftover === 0) {
        html += row("Each person pays", baseShare, "big");
        lines.push("Each person pays " + formatNaira(baseShare));
    } else {
        html += row(peopleWhoPay(leftover), baseShare + 1, "big");
        html += row(peopleWhoPay(people - leftover), baseShare);
        lines.push(peopleWhoPay(leftover) + " " + formatNaira(baseShare + 1));
        lines.push(
            peopleWhoPay(people - leftover) + " " + formatNaira(baseShare),
        );
    }

    showResult(html, lines);
}

// ---------- 8. Calculating: split by order ----------
function calculateByOrder() {
    const names = [];
    const orders = [];

    const personRows = orderList.querySelectorAll(".person");
    personRows.forEach(function (personRow, index) {
        const typedName = personRow.querySelector(".name").value.trim();
        const typedAmount = Number(personRow.querySelector(".amount").value);
        names.push(typedName || "Person " + (index + 1));
        orders.push(Math.round(typedAmount * 100));
    });

    const billKobo = orders.reduce(function (sum, o) {
        return sum + o;
    }, 0);

    if (billKobo <= 0) {
        showError("Please enter what at least one person ordered.");
        return;
    }

    const extras = readExtras(billKobo);
    const extrasTotal = extras.service + extras.vat + extras.delivery;

    // Choose how the extras are shared
    let weights;
    if (shareModeSelect.value === "order") {
        weights = orders;
    } else {
        weights = orders.map(function () {
            return 1;
        });
    }
    const extraShares = splitProportionally(extrasTotal, weights);

    // Top of the receipt and of the WhatsApp text
    let html = receiptTop(billKobo, extras);
    const lines = summaryTop(billKobo, extras);

    // Who pays what
    html += '<h3 class="sub">Who pays what</h3>';
    lines.push("", "*Who pays what*");
    names.forEach(function (name, i) {
        const amount = orders[i] + extraShares[i];
        html += row(escapeHTML(name), amount);
        lines.push(textLine(name, amount));
    });

    // Settle up: only if someone is chosen as the payer
    if (payerSelect.value !== "") {
        const payerIndex = Number(payerSelect.value);
        const payerName = names[payerIndex];
        const grandTotal = billKobo + extrasTotal;

        html += '<h3 class="sub">Settle up</h3>';
        html += row(escapeHTML(payerName) + " paid the full bill", grandTotal);
        lines.push("", "*Settle up*");
        lines.push(textLine(payerName + " paid the full bill", grandTotal));

        names.forEach(function (name, i) {
            if (i === payerIndex) return;
            const owed = orders[i] + extraShares[i];
            if (owed <= 0) return;
            html += row(
                escapeHTML(name) + " sends " + escapeHTML(payerName),
                owed,
            );
            lines.push(name + " sends " + payerName + " " + formatNaira(owed));
        });
    }

    showResult(html, lines);
}

// ---------- 9. Buttons: Calculate, Reset, Copy, WhatsApp ----------
calcBtn.addEventListener("click", function () {
    if (modeSelect.value === "equal") {
        calculateEqual();
    } else {
        calculateByOrder();
    }
});

resetBtn.addEventListener("click", function () {
    if (!confirm("Clear everything and start again?")) return;

    const boxes = [
        totalInput,
        peopleInput,
        serviceInput,
        vatInput,
        deliveryInput,
    ];
    boxes.forEach(function (box) {
        box.value = "";
    });

    modeSelect.value = "equal";
    shareModeSelect.value = "order";

    orderList.innerHTML = "";
    addPersonRow();
    addPersonRow();
    payerSelect.value = "";

    presetNote.classList.add("hidden");
    setActiveChip("");
    applyMode();

    try {
        localStorage.removeItem(SAVE_KEY);
    } catch (error) {
        // nothing to do
    }
});

copyBtn.addEventListener("click", function () {
    navigator.clipboard
        .writeText(summaryText)
        .then(function () {
            copyBtn.textContent = "Copied ✓";
        })
        .catch(function () {
            copyBtn.textContent = "Could not copy";
        })
        .finally(function () {
            setTimeout(function () {
                copyBtn.textContent = "Copy summary";
            }, 2000);
        });
});

whatsappBtn.addEventListener("click", function () {
    const link = "https://wa.me/?text=" + encodeURIComponent(summaryText);
    window.open(link, "_blank");
});

// ---------- 10. Save on every change, and start up ----------
card.addEventListener("input", saveState);
card.addEventListener("change", saveState);

// If there is a saved bill, restore it. Otherwise start with two empty rows.
if (!loadState()) {
    addPersonRow();
    addPersonRow();
}
