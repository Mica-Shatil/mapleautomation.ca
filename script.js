(function () {
  "use strict";

  const $ = (selector, context = document) => context.querySelector(selector);
  const $$ = (selector, context = document) => Array.from(context.querySelectorAll(selector));
  const safeStorageGet = (key) => {
    try { return window.sessionStorage.getItem(key); } catch { return null; }
  };
  const safeStorageSet = (key, value) => {
    try { window.sessionStorage.setItem(key, value); } catch { /* Storage is optional. */ }
  };

  const header = $("[data-header]");
  const menuToggle = $("[data-menu-toggle]");
  const nav = $("[data-nav]");

  const updateHeader = () => header?.classList.toggle("is-scrolled", window.scrollY > 16);
  updateHeader();
  window.addEventListener("scroll", updateHeader, { passive: true });

  if (menuToggle && nav) {
    const menuLabel = $("[data-menu-label]", menuToggle);
    const main = $("main");
    const footer = $("footer");
    const closeMenu = (returnFocus = false) => {
      menuToggle.setAttribute("aria-expanded", "false");
      nav.classList.remove("is-open");
      document.body.classList.remove("menu-open");
      if (menuLabel) menuLabel.textContent = "Open navigation";
      if (main) main.inert = false;
      if (footer) footer.inert = false;
      if (returnFocus) menuToggle.focus();
    };

    menuToggle.addEventListener("click", () => {
      const open = menuToggle.getAttribute("aria-expanded") !== "true";
      menuToggle.setAttribute("aria-expanded", String(open));
      nav.classList.toggle("is-open", open);
      document.body.classList.toggle("menu-open", open);
      if (menuLabel) menuLabel.textContent = open ? "Close navigation" : "Open navigation";
      if (main) main.inert = open;
      if (footer) footer.inert = open;
      if (open) $("a", nav)?.focus();
    });

    $$("a", nav).forEach((link) => link.addEventListener("click", () => closeMenu(false)));
    document.addEventListener("keydown", (event) => {
      const isOpen = nav.classList.contains("is-open");
      if (event.key === "Escape" && isOpen) closeMenu(true);
      if (event.key === "Tab" && isOpen) {
        const focusable = [menuToggle, ...$$("a", nav)];
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    });
    window.addEventListener("resize", () => {
      if (window.innerWidth > 820 && nav.classList.contains("is-open")) closeMenu();
    });
  }

  const caseRows = $$(".case-row");
  caseRows.forEach((row) => {
    const trigger = $(".case-trigger", row);
    const panel = $(".case-panel", row);
    const toggle = $(".case-toggle", row);
    if (!trigger || !panel) return;

    trigger.addEventListener("click", () => {
      const wasOpen = trigger.getAttribute("aria-expanded") === "true";
      caseRows.forEach((otherRow) => {
        const otherTrigger = $(".case-trigger", otherRow);
        const otherPanel = $(".case-panel", otherRow);
        const otherToggle = $(".case-toggle", otherRow);
        otherRow.classList.remove("is-open");
        otherTrigger?.setAttribute("aria-expanded", "false");
        if (otherPanel) otherPanel.hidden = true;
        if (otherToggle) otherToggle.textContent = "+";
      });

      if (!wasOpen) {
        row.classList.add("is-open");
        trigger.setAttribute("aria-expanded", "true");
        panel.hidden = false;
        if (toggle) toggle.textContent = "−";
      }
    });
  });

  const calculator = $("[data-calculator]");
  if (calculator) {
    const peopleInput = calculator.elements.people;
    const hoursInput = calculator.elements.hours;
    const shareInput = calculator.elements.share;
    const rateInput = calculator.elements.rate;
    const shareOutput = calculator.elements.shareOutput;
    const hoursResult = $("[data-hours-result]", calculator);
    const valueResult = $("[data-value-result]", calculator);
    const cta = $("[data-calc-cta]", calculator);
    const numberFormat = new Intl.NumberFormat("en-CA", { maximumFractionDigits: 0 });

    const boundedValue = (input) => {
      if (!input.value.trim()) return null;
      const value = Number(input.value);
      const min = Number(input.min || 0);
      const max = Number(input.max || Number.MAX_SAFE_INTEGER);
      if (!Number.isFinite(value) || value < min || value > max) return null;
      return value;
    };
    const calculate = () => {
      const peopleValue = boundedValue(peopleInput);
      const weeklyHours = boundedValue(hoursInput);
      const share = Math.max(0, Number(shareInput.value) || 0) / 100;
      const rate = boundedValue(rateInput);
      shareOutput.value = `${shareInput.value}%`;

      if (peopleValue === null || weeklyHours === null || rate === null) {
        hoursResult.textContent = "—";
        valueResult.textContent = "—";
        delete cta.dataset.estimate;
        return;
      }

      const people = Math.round(peopleValue);
      const monthlyHours = people * weeklyHours * (52 / 12) * share;
      const monthlyValue = monthlyHours * rate;

      hoursResult.textContent = numberFormat.format(monthlyHours);
      valueResult.textContent = numberFormat.format(monthlyValue);
      cta.dataset.estimate = `${numberFormat.format(monthlyHours)} hours/month (approx. $${numberFormat.format(monthlyValue)} CAD capacity value)`;
    };

    [peopleInput, hoursInput, shareInput, rateInput].forEach((input) => input.addEventListener("input", calculate));
    calculator.addEventListener("submit", (event) => event.preventDefault());
    cta.addEventListener("click", () => {
      safeStorageSet("mapleAutomationEstimate", cta.dataset.estimate || "");
    });
    calculate();
  }

  const contactForm = $("[data-contact-form]");
  if (contactForm) {
    const workflowField = contactForm.elements.workflow;
    const savedEstimate = safeStorageGet("mapleAutomationEstimate");
    if (savedEstimate && workflowField && !workflowField.value) {
      workflowField.placeholder = `My estimate: ${savedEstimate}. The workflow is…`;
    }

    const status = $("[data-form-status]", contactForm);
    const submitButton = $("button[type=submit]", contactForm);

    contactForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!contactForm.reportValidity()) return;

      const data = new URLSearchParams(new FormData(contactForm));
      data.set("estimate", safeStorageGet("mapleAutomationEstimate") || "");

      if (submitButton) submitButton.disabled = true;
      if (status) status.textContent = "Sending…";
      try {
        // The owner's own Google Apps Script (site-ops/contact-form-apps-script.gs) logs the
        // inquiry to a private Sheet and emails it to Mica.
        const response = await fetch(contactForm.dataset.endpoint, { method: "POST", body: data });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result.ok) throw new Error(result.error || `HTTP ${response.status}`);
        contactForm.reset();
        if (status) status.textContent = "Thanks — your message was sent. Mica will reply personally.";
      } catch {
        if (status) status.textContent = "Sorry, that didn’t send. Please try again, or email hello@mapleautomation.ca directly.";
      } finally {
        if (submitButton) submitButton.disabled = false;
      }
    });
  }

  const year = $("[data-year]");
  if (year) year.textContent = String(new Date().getFullYear());

  const revealItems = $$("[data-reveal]");
  if ("IntersectionObserver" in window && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    document.documentElement.classList.add("reveal-ready");
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    revealItems.forEach((item) => observer.observe(item));
  } else {
    revealItems.forEach((item) => item.classList.add("is-visible"));
  }
})();
