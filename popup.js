const statusSpan = document.getElementById("payload-status");
const inputBox = document.getElementById("input-box");
const saveButton = document.getElementById("saveBtn");
const loginButon = document.getElementById("loginBtn");
const debugButton = document.getElementById("debugBtn");
const swiftLoginButton = document.getElementById("swiftLoginBtn");
const expirationTime = 20 * 60 * 1000; // 20 minutes in milliseconds

const timerSpan = document.getElementById("timer");

let timerInterval;

function payloadStatusExpired() {
  statusSpan.classList.add("expired");
  statusSpan.classList.remove("available");
}
function payloadStatusAvailable() {
  statusSpan.classList.add("available");
  statusSpan.classList.remove("expired");
}

function updateTimer() {
  chrome.storage.local.get("timer", (data) => {
    const currentTime = Date.now();
    const savedTime = data.timer;

    if (savedTime) {
      const timeLeft = expirationTime - (currentTime - savedTime);
      if (timeLeft > 0) {
        const minutes = Math.floor(timeLeft / 60000);
        const seconds = Math.floor((timeLeft % 60000) / 1000);
        if (minutes === 0) {
          timerSpan.textContent = `valid for ${seconds}s`;
        } else {
          timerSpan.textContent = `valid for ${minutes}m ${seconds}s`;
        }
      } else {
        timerSpan.textContent = "expired!";
        payloadStatusExpired(); // Update status to expired
        clearInterval(timerInterval); // Clear the interval once expired
      }
    } else {
      timerSpan.textContent = "expired!";
      clearInterval(timerInterval); // Clear the interval if no timer is set
    }
  });
}
function startTimer(){
  timerInterval = setInterval(updateTimer, 1000); // Update the timer every second
}

document.addEventListener("DOMContentLoaded", () => {
  chrome.storage.local.get(["userData", "timer"], (data) => {
    const currentTime = Date.now();
    const savedTime = data.timer;

    if (data.userData) {
      if (savedTime && currentTime - savedTime > expirationTime) {
        // More than 20 minutes have passed
        payloadStatusExpired();
        timerSpan.textContent = "expired!";
      } else {
        // Less than 20 minutes
        payloadStatusAvailable();
        startTimer();
      }
    } else {
      payloadStatusExpired();
      timerSpan.textContent = "not set!";
    }
  });
});

saveButton.addEventListener("click", () => {
  const json = inputBox.value;
  try {
    JSON.parse(json); // Validate JSON format
    const parsed = JSON.stringify(json);
    chrome.storage.local.set({ userData: parsed, timer: Date.now() }, () => {
      inputBox.placeholder = "success! event payload saved...";
      inputBox.value = "";
    });

    payloadStatusAvailable();
    startTimer();
  } catch (e) {
    alert("Invalid JSON");
  }
});

inputBox.addEventListener("keypress", function (event) {
  if (event.key === "Enter") {
    event.preventDefault();
    saveButton.click(); // Trigger the save button click
  }
});

function runLoginScript() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.scripting.executeScript({
      target: { tabId: tabs[0].id },
      func: runLoginSequence,
    });
  });
}

function runDebugScript() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const activeTab = tabs[0];
    if (activeTab?.url) {
      const url = new URL(activeTab.url);
      url.searchParams.append("debug", "true");
      chrome.tabs.update(activeTab.id, { url: url.toString() });
    }
  });
}

// feature: login
loginButon.addEventListener("click", () => {
  runLoginScript();
});

// feature: swift loign
swiftLoginButton.addEventListener("click", () => {
  runDebugScript();
  // Run the login function twice with a 2-second interval
  // to ensure the event is triggered correctly.
  // This is a workaround for the issue where the event is not triggered correctly
  let count = 0;
  const timerInterval = setInterval(() => {
    runLoginScript();
    count++;
    if (count === 2) {
      clearInterval(timerInterval);
    }
  }, 2000);
});

// feature: open debug tool
debugButton.addEventListener("click", () => {
  runDebugScript();
});

function runLoginSequence() {
  chrome.storage.local.get("userData", (data) => {
    const json = JSON.parse(data.userData);
    const shadowHost = Array.from(document.body.children).find((el) =>
      el.tagName.toLowerCase().includes("root")
    );
    const shadowRoot = shadowHost?.shadowRoot;

    // 1. Open accordion
    const accordion = shadowRoot?.querySelector(".mat-expansion-panel-header");
    if (accordion) accordion.click();

    // 2. Select from dropdown
    const dropdowns = shadowRoot?.querySelectorAll("mat-select");
    const thirdDropdown = dropdowns?.[2];
    if (thirdDropdown) {
      thirdDropdown.click(); // Open the dropdown
      // Wait for the dropdown options to render
      setTimeout(() => {
        const options = document.querySelectorAll("mat-option");
        const desiredOption = Array.from(options).find(
          (option) => option.textContent.trim() === "InitContext"
        );
        if (desiredOption) {
          desiredOption.click(); // Select the "InitContext" option
        } else {
          console.error("Option 'InitContext' not found.");
        }
      }, 500);
    }

    // 3. Fill input box
    const inputBox = shadowRoot?.querySelector("#event-payload");
    setNativeValue(inputBox, json);

    // 4. Click button
    const button = shadowRoot?.querySelector("#test-event");
    if (button) button.click(); // Click the button
  });

  function setNativeValue(element, value) {
    const lastValue = element.value;
    element.value = value;

    const event = new Event("input", {
      bubbles: true,
      cancelable: true,
    });

    const tracker = element._valueTracker;
    if (tracker) {
      tracker.setValue(lastValue);
    }

    element.dispatchEvent(event);
  }
}
