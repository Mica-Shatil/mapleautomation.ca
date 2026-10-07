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

    contactForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const status = $("[data-form-status]", contactForm);
      if (!contactForm.reportValidity()) return;

      const data = new FormData(contactForm);
      const name = String(data.get("name") || "").trim();
      const email = String(data.get("email") || "").trim();
      const company = String(data.get("company") || "").trim() || "Not provided";
      const workflow = String(data.get("workflow") || "").trim();
      const timing = String(data.get("timing") || "Not specified");
      const estimate = safeStorageGet("mapleAutomationEstimate") || "Not calculated";
      const subject = encodeURIComponent(`Workflow inquiry from ${name}${company !== "Not provided" ? ` — ${company}` : ""}`);
      const body = encodeURIComponent(
        `Hi Mica,\n\nI'd like to explore an automation workflow.\n\nName: ${name}\nEmail: ${email}\nCompany: ${company}\nTiming: ${timing}\nCalculator estimate: ${estimate}\n\nWorkflow:\n${workflow}\n\nThanks,\n${name}`
      );

      if (status) status.textContent = "Attempting to open a Maple Automation email draft. If nothing happens, email hello@mapleautomation.ca directly.";
      window.location.href = `mailto:hello@mapleautomation.ca?subject=${subject}&body=${body}`;
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
