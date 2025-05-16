import "./styles/styles.scss";

import {
  categories,
  categoryEmojis,
  settings
} from "./data/definitions.js";

import { clearSVG, closeSVG } from "./data/icons.js";
import { checkIsMobile } from "./styles/helpers.js";

(function () {
  // State management
  const state = {
    eventListeners: [],
    activeCategory: localStorage.getItem("activeCategory") || "Boys",
    isPopupCreated: false,
    categoryHistory: [],
    currentSortedEmoticons: [],
    lastFocusedInput: null,
    latestCategoryRequest: null,
    lastKeyTimes: {},
    lastUsedEmoticons: JSON.parse(localStorage.getItem("lastUsedEmoticons")) || {},
    recentEmoticons: JSON.parse(localStorage.getItem("recentEmoticons")) || [],
    isMobile: checkIsMobile(),
    focusedSection: "recent", // Can be "category" or "recent"
    selectedRecentIndex: -1
  };

  // Helper function to handle double key presses
  function handleDoubleKeyPress(e, targetKey, threshold, callback) {
    const now = Date.now();
    if (e.code === targetKey) {
      if (now - (state.lastKeyTimes[targetKey] || 0) < threshold) {
        e.preventDefault();
        callback();
        state.lastKeyTimes[targetKey] = 0;
      } else {
        state.lastKeyTimes[targetKey] = now;
      }
    } else {
      state.lastKeyTimes[targetKey] = 0;
    }
  }

  // Create a helper function for long press handling
  function setupLongPress(container, longPressCallback) {
    let longPressTimer;
    let longPressTarget = null;

    // Pointer event handlers for long press (works for both mouse and touch)
    container.addEventListener("pointerdown", e => {
      const btn = e.target.closest("button.emoticon-button");
      if (!btn) return;

      longPressTarget = btn;
      longPressTimer = setTimeout(() => {
        if (longPressTarget) {
          e.preventDefault();
          longPressCallback(longPressTarget);
          longPressTarget = null; // Prevent normal click after long press
        }
      }, settings.longPressDelay);
    });

    // Clear timer if pointer moves away or is released before timeout
    const clearLongPressTimer = () => {
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }
    };

    container.addEventListener("pointerup", clearLongPressTimer);
    container.addEventListener("pointerleave", clearLongPressTimer);
    container.addEventListener("pointercancel", clearLongPressTimer);

    // Return the target to check in click handlers
    return () => longPressTarget;
  }

  // Initialize state
  const bodyLightness = getLightness(window.getComputedStyle(document.body).backgroundColor);
  const colors = {
    popupBackground: getAdjustedBackground("popupBackground"),
    defaultButton: getAdjustedBackground("defaultButton"),
    hoverButton: getAdjustedBackground("hoverButton"),
    activeButton: getAdjustedBackground("activeButton"),
    selectedButton: getAdjustedBackground("selectedButton")
  };

  // Set CSS variables
  Object.entries({
    'popup-background': colors.popupBackground,
    'default-button': colors.defaultButton,
    'hover-button': colors.hoverButton,
    'active-button': colors.activeButton,
    'selected-button': colors.selectedButton
  }).forEach(([name, value]) => {
    document.documentElement.style.setProperty(`--${name}`, value);
  });

  // Initialize last used emoticons
  Object.keys(categories).forEach(cat => {
    if (!Object.prototype.hasOwnProperty.call(state.lastUsedEmoticons, cat) || !categories[cat].includes(state.lastUsedEmoticons[cat])) {
      state.lastUsedEmoticons[cat] = categories[cat][0] || '';
    }
  });

  // UI/Color utility functions
  function getLightness(color) {
    const match = color.match(/\d+/g);
    if (match && match.length === 3) {
      const [r, g, b] = match.map(Number);
      const max = Math.max(r, g, b) / 255;
      const min = Math.min(r, g, b) / 255;
      return Math.round(((max + min) / 2) * 100);
    }
    return 0;
  }

  function getAdjustedBackground(type) {
    const adjustments = {
      popupBackground: 10,
      defaultButton: 15,
      hoverButton: 25,
      activeButton: 35,
      selectedButton: 50
    };
    const adjustment = adjustments[type] || 0;
    const adjustedLightness = bodyLightness < 50 ? bodyLightness + adjustment : bodyLightness - adjustment;
    return `hsl(0, 0%, ${adjustedLightness}%)`;
  }

  // Data management functions
  function loadFavoriteEmoticons() {
    categories.Favourites = JSON.parse(localStorage.getItem("favoriteEmoticons")) || [];
  }

  function loadEmoticonUsageData() {
    return JSON.parse(localStorage.getItem("emoticonUsageData")) || {};
  }

  function saveEmoticonUsageData(data) {
    localStorage.setItem("emoticonUsageData", JSON.stringify(data));
  }

  function incrementEmoticonUsage(emoticon) {
    const data = loadEmoticonUsageData();
    data[state.activeCategory] = data[state.activeCategory] || {};
    data[state.activeCategory][emoticon] = (data[state.activeCategory][emoticon] || 0) + 1;
    saveEmoticonUsageData(data);
  }

  // Function to add emoticon to recent list
  function addToRecentEmoticons(emoticon) {
    state.recentEmoticons = [
      emoticon,
      ...state.recentEmoticons.filter(e => e !== emoticon)
    ].slice(0, settings.maxRecentEmoticons);

    localStorage.setItem("recentEmoticons", JSON.stringify(state.recentEmoticons));
  }

  function getSortedEmoticons(category) {
    const usage = loadEmoticonUsageData()[category] || {};
    return categories[category].slice().sort((a, b) => (usage[b] || 0) - (usage[a] || 0));
  }

  function isEmoticonFavorite(emoticon) {
    const fav = JSON.parse(localStorage.getItem("favoriteEmoticons")) || [];
    return fav.includes(emoticon);
  }

  // Page context utility
  function getPageContext() {
    const path = window.location.pathname;
    const hash = window.location.hash;
    const searchParams = new URLSearchParams(window.location.search);
    const gmid = searchParams.get('gmid');
    const profileMatch = hash.match(/#\/(\d+)\//);

    return {
      isForum: path.includes('/forum/'),
      isGamelist: path.includes('/gamelist/'),
      isGame: !!gmid,
      isProfile: path === '/u/' && !!profileMatch,
      gmid: gmid || null,
      profileId: profileMatch?.[1] || null
    };
  }

  // Event handlers
  function onFocusIn(e) {
    if (e.target.matches("textarea, input.text, input#message-input")) {
      state.lastFocusedInput = e.target;
    }
  }

  function onKeyDown(e) {
    // Close popup if Ctrl+V is detected, assuming paste intention
    if (e.code === 'KeyV' && e.ctrlKey) {
      const popup = document.querySelector(".emoticons-popup");
      if (popup) removeEmoticonsPopup();
      return;
    }

    // Use the helper function for detecting a double [targetKey] press
    if (e.code === 'KeyQ') {
      handleDoubleKeyPress(e, 'KeyQ', 500, function () {
        // Remove duplicated trailing character from the focused text field, if available
        if (state.lastFocusedInput) {
          let value = state.lastFocusedInput.value;
          // If the last two characters are identical, remove them; otherwise remove one character
          if (value.length >= 2 && value.slice(-1) === value.slice(-2, -1)) {
            value = value.slice(0, -2);
          } else if (value.length >= 1) {
            value = value.slice(0, -1);
          }
          state.lastFocusedInput.value = value;
          // Set the cursor at the end of the updated value
          const pos = value.length;
          state.lastFocusedInput.setSelectionRange(pos, pos);
        }
        toggleEmoticonsPopup();
      });
    } else {
      // Reset the [targetKey] double‑press timer
      state.lastKeyTimes['KeyQ'] = 0;
    }
  }

  function onMouseUp(e) {
    // Check for ctrl+click on text inputs (textarea or input with class "text")
    if (e.ctrlKey && e.button === 0 && e.target.matches("textarea, input.text, input#message-input")) {
      e.preventDefault();
      toggleEmoticonsPopup();
    }
  }

  function closePopupOnKeydown(e) {
    const popup = document.querySelector(".emoticons-popup");
    // Close popup if the key is Escape or KeyQ (using e.code for layout independence)
    if (popup && (e.code === 'Escape' || e.code === 'KeyQ')) {
      e.preventDefault();
      removeEmoticonsPopup();
    }
  }

  function closePopupOnClickOutside(e) {
    const popup = document.querySelector(".emoticons-popup");
    if (popup && !popup.contains(e.target)) {
      removeEmoticonsPopup();
    }
  }

  function getEmoticonCode(emoticon) {
    const { isForum } = getPageContext();
    // Check if there is a focused element and if it is a textarea
    if (isForum && state.lastFocusedInput && state.lastFocusedInput.tagName.toLowerCase() === "textarea") {
      // Use bbcode format for textarea on forum pages
      return `[img]https://klavogonki.ru/img/smilies/${emoticon}.gif[/img] `;
    } else {
      // Otherwise, use the colon-based format
      return `:${emoticon}: `;
    }
  }

  function insertEmoticonCode(emoticon) {
    const context = getPageContext();
    let targetInput = state.lastFocusedInput;

    if (!targetInput) {
      if (context.isForum) {
        targetInput = document.getElementById('fast-reply_textarea');
      } else if (context.isGamelist) {
        targetInput = document.querySelector('#chat-general.chat .messages input.text');
      } else if (context.isGame) {
        targetInput = document.querySelector('[id^="chat-game"].chat .messages input.text');
      } else {
        // Fallback for other contexts - try any text input
        targetInput = document.querySelector('#app-chat-container #message-input');
      }

      if (!targetInput) {
        const labels = { isForum: "the forum", isProfile: "the profile", isGamelist: "general chat", isGame: "game chat" };
        const detected = Object.entries(labels).filter(([key]) => context[key]).map(([_, value]) => value).join(", ");
        alert(`Please focus on a text field in ${detected}.`);
        return;
      }
      if (!state.isMobile) targetInput.focus();
      state.lastFocusedInput = targetInput;
    }

    const code = getEmoticonCode(emoticon);
    const pos = targetInput.selectionStart || 0;
    targetInput.value = targetInput.value.slice(0, pos) + code + targetInput.value.slice(pos);
    targetInput.setSelectionRange(pos + code.length, pos + code.length);
    if (!state.isMobile) targetInput.focus();

    // Add to recent emoticons
    addToRecentEmoticons(emoticon);
  }

  // Event listeners cleanup
  function removeEventListeners() {
    state.eventListeners.forEach(({ event, handler }) => {
      document.removeEventListener(event, handler);
    });
    state.eventListeners = [];
  }

  // Animation utilities
  function toggleContainerSmoothly(container, action) {
    if (action === "show") {
      document.body.appendChild(container);
      requestAnimationFrame(() => {
        container.style.opacity = "1";
      });
    } else {
      container.style.opacity = "0";
      setTimeout(() => container.remove(), 300);
    }
  }

  // Popup control
  function removeEmoticonsPopup() {
    const popup = document.querySelector(".emoticons-popup");
    if (!popup) return;

    // teardown
    removeEventListeners();
    toggleContainerSmoothly(popup, "hide");
    state.isPopupCreated = false;

    // restore focus
    const input = state.lastFocusedInput;
    if (input) {
      input.focus();
      // place cursor at end
      const pos = input.value.length;
      input.setSelectionRange(pos, pos);
    }
  }

  function toggleEmoticonsPopup() {
    if (state.isPopupCreated) {
      removeEmoticonsPopup();
    } else {
      setTimeout(() => {
        createEmoticonsPopup(state.activeCategory);
      }, 10);
    }
  }

  // Function to update the toggle button icon and title
  function updateToggleButtonIcon() {
    const toggleBtn = document.querySelector(".emoticons-toggle");
    if (toggleBtn) {
      toggleBtn.innerHTML = categoryEmojis[state.activeCategory] || "😊";
      toggleBtn.title = `Open emoticons panel (${state.activeCategory})`;
    }
  }

  // Define a helper to create the toggle button
  function createToggleButton() {
    const toggleBtn = document.createElement("button");
    toggleBtn.className = "emoticons-toggle";
    toggleBtn.title = `Open emoticons panel (${state.activeCategory})`;
    toggleBtn.innerHTML = categoryEmojis[state.activeCategory] || "😊";

    toggleBtn.addEventListener("click", toggleEmoticonsPopup);
    document.body.appendChild(toggleBtn);
  }

  createToggleButton();

  // UI creation
  function createEmoticonsPopup(category) {
    if (state.isPopupCreated) return;
    loadFavoriteEmoticons();

    const popup = document.createElement("div");
    popup.className = "emoticons-popup";

    const headerButtons = document.createElement("div");
    headerButtons.className = "header-buttons";

    const createBtn = (className, title, innerHTML, clickHandler) => {
      const btn = document.createElement("button");
      btn.className = className;
      btn.title = title;
      btn.innerHTML = innerHTML;
      if (clickHandler) btn.addEventListener("click", clickHandler);
      return btn;
    };

    const clearButton = createBtn("header-button clear-button", "Clear usage data", clearSVG, () => {
      if (confirm("Clear emoticon usage data?")) {
        // clear usage data
        localStorage.removeItem("emoticonUsageData");

        // clear recent emoticons
        localStorage.removeItem("recentEmoticons");
        state.recentEmoticons = [];

        // remove recent-emoticons container from the popup
        const recentContainer = document.querySelector(".recent-emoticons");
        if (recentContainer) recentContainer.remove();
        const categoryLabel = document.querySelector(".category-label");
        if (categoryLabel) categoryLabel.remove();
      }
    });

    const closeButton = createBtn("header-button close-button", "Close emoticons panel", closeSVG, removeEmoticonsPopup);

    headerButtons.appendChild(clearButton);
    headerButtons.appendChild(createCategoryContainer());
    headerButtons.appendChild(closeButton);
    popup.appendChild(headerButtons);

    // Create recent emoticons container if there are any
    if (state.recentEmoticons.length > 0) {
      createRecentEmoticonsContainer().then((container) => {
        popup.appendChild(container);
      });
    }

    createEmoticonsContainer(category).then((container) => {
      popup.appendChild(container);
      requestAnimationFrame(updateEmoticonHighlight);
    });

    const eventListenersArray = [
      { event: "keydown", handler: navigateEmoticons },
      { event: "keydown", handler: switchEmoticonCategory },
      { event: "keydown", handler: closePopupOnKeydown },
      { event: "click", handler: closePopupOnClickOutside }
    ];

    eventListenersArray.forEach(({ event, handler }) => {
      state.eventListeners.push({ event, handler });
      document.addEventListener(event, handler);
    });

    document.body.appendChild(popup);
    toggleContainerSmoothly(popup, "show");
    state.isPopupCreated = true;
  }

  // Helper function to create a base container
  function createBaseContainer(className = "category-emoticon-buttons") {
    const container = document.createElement("div");
    container.className = className;
    container.addEventListener("contextmenu", e => e.preventDefault());
    return container;
  }

  // Helper function to create emoticon buttons
  function createEmoticonButton(emoticon, additionalClasses = "") {
    const btn = document.createElement("button");
    btn.className = `emoticon-button ${additionalClasses}`;
    btn.title = emoticon;
    const imgSrc = `/img/smilies/${emoticon}.gif`;
    btn.innerHTML = `<img src="${imgSrc}" alt="${emoticon}">`;
    return { btn, imgSrc };
  }

  // Helper function to preload images and return promises
  function preloadEmoticonImage(imgSrc) {
    return new Promise(resolve => {
      const img = new Image();
      img.onload = resolve;
      img.src = imgSrc;
    });
  }

  // Helper function to handle button click events
  function handleEmoticonButtonClick(e, getLongPressTarget, onClickAction) {
    const btn = e.target.closest("button.emoticon-button");
    if (!btn || !getLongPressTarget()) return; // Skip if this was a long press that already triggered

    e.stopPropagation();
    const emoticon = btn.title;

    onClickAction(emoticon, e);
  }

  // Helper function to configure grid sizing
  async function configureEmoticonGrid(container, emoticons) {
    const { maxImageWidth, maxImageHeight } = await calculateMaxImageDimensions(emoticons);
    Object.assign(container.style, {
      gridTemplateColumns: `repeat(auto-fit, minmax(${maxImageWidth}px, 1fr))`,
      gridAutoRows: `minmax(${maxImageHeight}px, auto)`
    });
  }

  async function createRecentEmoticonsContainer() {
    const container = document.createElement("div");
    container.className = "recent-emoticons";

    const emoticonButtons = createBaseContainer("recent-emoticon-buttons");

    const label = document.createElement("span");
    label.className = "label recent-label";
    label.textContent = "Recently used";
    container.appendChild(label);

    // Setup long press for removing recent emoticons
    const getLongPressTarget = setupLongPress(emoticonButtons, (target) => {
      handleRecentsClick(target.title, target);
    });

    // Preload images and populate DOM
    const loadPromises = state.recentEmoticons.map(emoticon => {
      const { btn, imgSrc } = createEmoticonButton(emoticon, "recent-button");
      emoticonButtons.appendChild(btn);
      return preloadEmoticonImage(imgSrc);
    });

    // Helper function to remove emoticon from recents
    function handleRecentsClick(emoticon, target) {
      const index = state.recentEmoticons.indexOf(emoticon);
      if (index !== -1) {
        state.recentEmoticons.splice(index, 1);
        localStorage.setItem("recentEmoticons", JSON.stringify(state.recentEmoticons));
        // Remove only the specific emoticon button
        target.remove();
        // If no more recent emoticons, remove the entire recent section (including its label)
        if (state.recentEmoticons.length === 0) {
          const recentsSection = document.querySelector(".recent-emoticons");
          if (recentsSection) recentsSection.remove();
        }
      }
    }

    // Click handler for recent emoticons
    emoticonButtons.addEventListener("click", e =>
      handleEmoticonButtonClick(e, getLongPressTarget, (emoticon, event) => {
        // Handle ctrl+click to remove recent emoticon
        if (event.ctrlKey) {
          handleRecentsClick(emoticon, event.target.closest("button.emoticon-button"));
          return;
        }

        insertEmoticonCode(emoticon);
        incrementEmoticonUsage(emoticon);
        state.lastUsedEmoticons[state.activeCategory] = emoticon;
        localStorage.setItem("lastUsedEmoticons", JSON.stringify(state.lastUsedEmoticons));

        if (!state.isMobile && !event.shiftKey) removeEmoticonsPopup();
        updateEmoticonHighlight();
      })
    );

    // Wait for all images, then set grid sizing
    await Promise.all(loadPromises);
    await configureEmoticonGrid(emoticonButtons, state.recentEmoticons);

    container.appendChild(emoticonButtons);
    return container;
  }

  async function createEmoticonsContainer(category) {
    const container = document.createElement("div");
    container.className = "category-emoticons";

    const emoticonButtons = createBaseContainer();

    if (state.recentEmoticons.length > 0) {
      // look in the document instead of in this newly created container
      if (!document.querySelector(".category-emoticons .category-label")) {
        const label = document.createElement("span");
        label.className = "label category-label";
        label.textContent = "Category section";
        container.appendChild(label);
      }
    }

    state.currentSortedEmoticons = getSortedEmoticons(category);

    // Helper function to toggle favorite status
    const toggleFavorite = (emoticon) => {
      const fav = JSON.parse(localStorage.getItem("favoriteEmoticons")) || [];
      const idx = fav.indexOf(emoticon);
      if (category === "Favourites" && idx !== -1) {
        fav.splice(idx, 1);
        categories.Favourites.splice(idx, 1);
      } else if (category !== "Favourites" && idx === -1) {
        fav.push(emoticon);
        categories.Favourites.push(emoticon);
      }
      localStorage.setItem("favoriteEmoticons", JSON.stringify(fav));
      updateCategoryButtonsState(category);
      if (category === "Favourites") updateEmoticonsContainer();
      updateEmoticonHighlight();
    };

    // Setup long press for toggling favorites
    const getLongPressTarget = setupLongPress(emoticonButtons, (target) => {
      const emoticon = target.title;
      toggleFavorite(emoticon);
    });

    // Preload images and populate DOM
    const loadPromises = state.currentSortedEmoticons.map(emoticon => {
      let additionalClass = "";
      if (emoticon === state.lastUsedEmoticons[state.activeCategory]) {
        additionalClass = "selected";
      } else if (state.activeCategory !== "Favourites" && isEmoticonFavorite(emoticon)) {
        additionalClass = "favorite";
      }

      const { btn, imgSrc } = createEmoticonButton(emoticon, additionalClass);
      emoticonButtons.appendChild(btn);
      return preloadEmoticonImage(imgSrc);
    });

    // Delegate all click handling to the emoticonButtons
    emoticonButtons.addEventListener("click", e =>
      handleEmoticonButtonClick(e, getLongPressTarget, (emoticon, event) => {
        if (event.shiftKey) {
          insertEmoticonCode(emoticon);
        } else if (event.ctrlKey) {
          // toggle favorite with ctrl+click
          toggleFavorite(emoticon);
        } else {
          insertEmoticonCode(emoticon);
          incrementEmoticonUsage(emoticon);
          state.lastUsedEmoticons[state.activeCategory] = emoticon;
          localStorage.setItem("lastUsedEmoticons", JSON.stringify(state.lastUsedEmoticons));
          if (!state.isMobile) removeEmoticonsPopup();
        }
        updateEmoticonHighlight();
      })
    );

    // wait for all images, then set grid sizing
    await Promise.all(loadPromises);
    await configureEmoticonGrid(emoticonButtons, state.currentSortedEmoticons);

    container.appendChild(emoticonButtons);
    return container;
  }

  function createCategoryContainer() {
    const container = document.createElement("div");
    container.className = "category-buttons";

    Object.keys(categories).forEach(cat => {
      const btn = document.createElement("button");
      btn.className = [
        "category-button",
        cat === state.activeCategory && "active",
        cat === "Favourites" && !categories.Favourites.length && "disabled"
      ].filter(Boolean).join(" ");
      btn.dataset.category = cat;
      btn.innerHTML = categoryEmojis[cat];
      btn.title = cat;
      container.appendChild(btn);
    });

    container.addEventListener("click", e => {
      const btn = e.target.closest("button.category-button");
      if (!btn) return;
      const cat = btn.dataset.category;
      if (cat === "Favourites" && e.ctrlKey) {
        handleFavouritesClick(e);
      } else {
        handleCategoryClick(cat, e);
      }
    });

    return container;
  }

  // Category handling
  function handleCategoryClick(cat, e) {
    if (!e.shiftKey && !e.ctrlKey) {
      changeActiveCategoryOnClick(cat);
    }
  }

  function handleFavouritesClick(e) {
    if (e.ctrlKey) {
      localStorage.removeItem("favoriteEmoticons");
      categories.Favourites = [];
      updateEmoticonHighlight();
      if (state.categoryHistory.length) {
        state.activeCategory = state.categoryHistory.pop();
        localStorage.setItem("activeCategory", state.activeCategory);
        updateCategoryButtonsState(state.activeCategory);
        updateEmoticonsContainer();
        updateToggleButtonIcon();
      }
    }
  }

  function updateCategoryButtonsState(newCategory) {
    document.querySelectorAll(".category-buttons button").forEach((btn) => {
      if (btn.dataset.category === newCategory) {
        btn.classList.add("active");
      } else {
        btn.classList.remove("active");
      }
      if (btn.dataset.category === "Favourites") {
        if (categories.Favourites.length === 0) {
          btn.classList.add("disabled");
        } else {
          btn.classList.remove("disabled");
        }
      }
    });
  }

  function changeActiveCategoryOnClick(newCategory) {
    if (newCategory === "Favourites" && categories.Favourites.length === 0) return;
    if (state.activeCategory !== "Favourites") {
      state.categoryHistory.push(state.activeCategory);
    }
    state.activeCategory = newCategory;
    localStorage.setItem("activeCategory", state.activeCategory);
    state.currentSortedEmoticons = getSortedEmoticons(state.activeCategory);
    updateCategoryButtonsState(state.activeCategory);
    updateEmoticonsContainer();
    updateToggleButtonIcon();
  }

  async function calculateMaxImageDimensions(emoticonsImages) {
    const minValue = 34;
    const imageDimensions = await Promise.all(
      emoticonsImages.map((imageName) => {
        return new Promise((resolve) => {
          const img = new Image();
          img.onload = () => resolve({ width: img.width, height: img.height });
          img.src = `/img/smilies/${imageName}.gif`;
        });
      })
    );
    const maxWidth = Math.max(minValue, ...imageDimensions.map(img => img.width));
    const maxHeight = Math.max(minValue, ...imageDimensions.map(img => img.height));
    return { maxImageWidth: maxWidth, maxImageHeight: maxHeight };
  }

  function updateEmoticonsContainer() {
    const requestTimestamp = Date.now();
    state.latestCategoryRequest = requestTimestamp;

    // Remove the entire old category-emoticons wrapper (including its label) to avoid duplicates
    const oldSection = document.querySelector(".category-emoticons");
    if (oldSection) oldSection.remove();

    // Create a fresh emoticons container and append if it's still the latest
    createEmoticonsContainer(state.activeCategory).then((container) => {
      if (state.latestCategoryRequest !== requestTimestamp) return;
      const popup = document.querySelector(".emoticons-popup");
      if (popup) {
        popup.appendChild(container);
        updateEmoticonHighlight();
      }
    });
  }

  // Navigation and selection
  function updateEmoticonHighlight() {
    requestAnimationFrame(() => {
      // First, remove highlighting from all buttons
      document.querySelectorAll(".emoticon-button").forEach(btn => {
        btn.classList.remove("selected", "favorite", "section-focused");
      });

      // Remove section focus highlight
      document.querySelectorAll(".category-label, .recent-label")
        .forEach(label => label.classList.remove("focused-section"));

      // Highlight the focused section
      const labelSelector = state.focusedSection === "category"
        ? ".category-label"
        : ".recent-label";
      const focusedLabel = document.querySelector(labelSelector);
      if (focusedLabel) {
        focusedLabel.classList.add("focused-section");
      }

      // Highlight category buttons
      if (state.activeCategory) {
        const categoryButtons = document.querySelectorAll(".category-emoticon-buttons button");
        categoryButtons.forEach((btn) => {
          const emoticon = btn.title;
          if (emoticon === state.lastUsedEmoticons[state.activeCategory]) {
            btn.classList.add("selected");
            if (state.focusedSection === "category") {
              btn.classList.add("section-focused");
            }
          } else if (state.activeCategory !== "Favourites" && isEmoticonFavorite(emoticon)) {
            btn.classList.add("favorite");
          }
        });
      }

      // Highlight recent buttons
      if (state.recentEmoticons.length > 0) {
        const recentButtons = document.querySelectorAll(".recent-emoticon-buttons button");
        recentButtons.forEach((btn, index) => {
          if (index === state.selectedRecentIndex) {
            btn.classList.add("selected");
            if (state.focusedSection === "recent") {
              btn.classList.add("section-focused");
            }
          }
        });
      }
    });
  }

  function navigateEmoticons(e) {
    const popup = document.querySelector(".emoticons-popup");
    if (!popup) return;

    // Check if the focused section exists
    const focusedSectionSelector = state.focusedSection === "category"
      ? ".category-emoticon-buttons"
      : ".recent-emoticon-buttons";

    const focusedSection = document.querySelector(focusedSectionSelector);
    if (!focusedSection) {
      // If focused section doesn't exist, default to category
      state.focusedSection = "category";
    }

    const handledKeys = new Set(['Enter', 'Semicolon', 'ArrowLeft', 'KeyJ', 'ArrowRight', 'KeyK', 'KeyS']);
    if (!handledKeys.has(e.code)) return;

    e.preventDefault();

    // Handle S key to switch focus between sections
    if (e.code === "KeyS") {
      // Toggle between recent and category if recents exist
      const hasRecents = document.querySelector(".recent-emoticon-buttons") !== null;
      if (state.focusedSection === "category" && hasRecents) {
        state.focusedSection = "recent";
        // Initialize selection in recents if none exists
        if (state.selectedRecentIndex === -1 && state.recentEmoticons.length > 0) {
          state.selectedRecentIndex = 0;
        }
      } else {
        state.focusedSection = "category";
      }
      updateEmoticonHighlight();
      return;
    }

    // Handle enter or semicolon (select emoticon)
    if (e.code === "Enter" || e.code === "Semicolon") {
      let emoticon;

      if (state.focusedSection === "category") {
        emoticon = state.lastUsedEmoticons[state.activeCategory];
      } else if (state.selectedRecentIndex !== -1 && state.selectedRecentIndex < state.recentEmoticons.length) {
        emoticon = state.recentEmoticons[state.selectedRecentIndex];
      }

      if (emoticon) {
        insertEmoticonCode(emoticon);
        incrementEmoticonUsage(emoticon);
        if (!e.shiftKey) removeEmoticonsPopup();
      }
    } else if (e.code === "ArrowLeft" || e.code === "KeyJ") {
      // Navigate left
      navigateSelection(-1);
    } else if (e.code === "ArrowRight" || e.code === "KeyK") {
      // Navigate right
      navigateSelection(1);
    }
  }

  function navigateSelection(direction) {
    if (state.focusedSection === "category") {
      // Category navigation
      const currentIndex = state.currentSortedEmoticons.indexOf(state.lastUsedEmoticons[state.activeCategory]);
      let newIndex = currentIndex === -1 ? 0 : currentIndex + direction;

      // Handle wrapping
      if (newIndex < 0) newIndex = state.currentSortedEmoticons.length - 1;
      if (newIndex >= state.currentSortedEmoticons.length) newIndex = 0;

      // Update state
      state.lastUsedEmoticons[state.activeCategory] = state.currentSortedEmoticons[newIndex];
      localStorage.setItem("lastUsedEmoticons", JSON.stringify(state.lastUsedEmoticons));
    } else {
      // Recent emoticons navigation
      if (state.recentEmoticons.length === 0) return;

      // Calculate new index with wrapping
      let newIndex = state.selectedRecentIndex === -1 ? 0 : state.selectedRecentIndex + direction;
      if (newIndex < 0) newIndex = state.recentEmoticons.length - 1;
      if (newIndex >= state.recentEmoticons.length) newIndex = 0;

      // Update state
      state.selectedRecentIndex = newIndex;
    }

    // Update the UI
    updateEmoticonHighlight();
  }

  function switchEmoticonCategory(e) {
    const emoticonPopup = document.querySelector(".emoticons-popup");
    if (!emoticonPopup || (!(["Tab", "KeyH", "KeyL"].includes(e.code)) && !(e.code === "Tab" && e.shiftKey))) return;

    e.preventDefault();
    const keys = Object.keys(categories);
    const favs = JSON.parse(localStorage.getItem("favoriteEmoticons")) || [];
    const navKeys = favs.length === 0 ? keys.filter(key => key !== "Favourites") : keys;
    let idx = navKeys.indexOf(state.activeCategory);
    if (idx === -1) idx = 0;

    let newIdx = ((e.code === "Tab" && !e.shiftKey) || e.code === "KeyL") && idx < navKeys.length - 1 ? idx + 1 :
      ((e.code === "KeyH" || (e.code === "Tab" && e.shiftKey)) && idx > 0) ? idx - 1 : idx;
    if (newIdx === idx) return;

    const next = navKeys[newIdx];
    state.currentSortedEmoticons = getSortedEmoticons(next);
    localStorage.setItem("activeCategory", next);
    changeActiveCategoryOnClick(next);
    updateToggleButtonIcon();
  }

  // Set up main event listeners
  document.addEventListener("focusin", onFocusIn);
  document.addEventListener("mouseup", onMouseUp);
  document.addEventListener("keydown", onKeyDown);
})();