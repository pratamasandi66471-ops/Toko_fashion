(() => {
  const authMain = document.querySelector('.auth-main');
  if (!authMain) return;

  const registerForm = document.querySelector('form[action="/register"]');
  const loginForm = document.querySelector('form[action="/login"]');

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const phoneRegex = /^[0-9+\-\s]{8,20}$/;

  function getOrCreateErrorEl(inputOrName) {
    let field;
    if (typeof inputOrName === 'string') {
      field = document.querySelector(`[name="${inputOrName}"]`);
    } else {
      field = inputOrName;
    }

    if (!field) return null;

    let errorEl = field.parentElement?.querySelector(`.client-error[data-for="${field.name}"]`);
    if (!errorEl) {
      errorEl = document.createElement('small');
      errorEl.className = 'auth-field-error client-error';
      errorEl.dataset.for = field.name;
      field.insertAdjacentElement('afterend', errorEl);
    }

    return errorEl;
  }

  function setFieldError(field, message) {
    const errorEl = getOrCreateErrorEl(field);
    if (!errorEl) return;
    errorEl.textContent = message || '';
    errorEl.style.display = message ? 'block' : 'none';
  }

  function validateRegister(form) {
    const name = form.querySelector('[name="name"]');
    const email = form.querySelector('[name="email"]');
    const phone = form.querySelector('[name="phone"]');
    const password = form.querySelector('[name="password"]');
    const confirmPassword = form.querySelector('[name="confirm_password"]');
    const terms = form.querySelector('[name="terms"]');

    let isValid = true;

    if (!name.value.trim()) {
      setFieldError(name, 'Nama wajib diisi.');
      isValid = false;
    } else {
      setFieldError(name, '');
    }

    if (!email.value.trim()) {
      setFieldError(email, 'Email wajib diisi.');
      isValid = false;
    } else if (!emailRegex.test(email.value.trim())) {
      setFieldError(email, 'Format email tidak valid.');
      isValid = false;
    } else {
      setFieldError(email, '');
    }

    if (!phone.value.trim()) {
      setFieldError(phone, 'Nomor telepon wajib diisi.');
      isValid = false;
    } else if (!phoneRegex.test(phone.value.trim())) {
      setFieldError(phone, 'Nomor telepon tidak valid.');
      isValid = false;
    } else {
      setFieldError(phone, '');
    }

    if (!password.value) {
      setFieldError(password, 'Password wajib diisi.');
      isValid = false;
    } else if (password.value.length < 8) {
      setFieldError(password, 'Password minimal 8 karakter.');
      isValid = false;
    } else {
      setFieldError(password, '');
    }

    if (!confirmPassword.value) {
      setFieldError(confirmPassword, 'Konfirmasi password wajib diisi.');
      isValid = false;
    } else if (confirmPassword.value !== password.value) {
      setFieldError(confirmPassword, 'Konfirmasi password tidak sama.');
      isValid = false;
    } else {
      setFieldError(confirmPassword, '');
    }

    if (!terms.checked) {
      setFieldError('terms', 'Kamu harus menyetujui syarat dan ketentuan.');
      isValid = false;
    } else {
      setFieldError('terms', '');
    }

    return isValid;
  }

  function validateLogin(form) {
    const email = form.querySelector('[name="email"]');
    const password = form.querySelector('[name="password"]');

    let isValid = true;

    if (!email.value.trim()) {
      setFieldError(email, 'Email wajib diisi.');
      isValid = false;
    } else if (!emailRegex.test(email.value.trim())) {
      setFieldError(email, 'Format email tidak valid.');
      isValid = false;
    } else {
      setFieldError(email, '');
    }

    if (!password.value) {
      setFieldError(password, 'Password wajib diisi.');
      isValid = false;
    } else {
      setFieldError(password, '');
    }

    return isValid;
  }

  function setSubmitState(form, enabled) {
    const submitBtn = form.querySelector('button[type="submit"]');
    if (!submitBtn) return;

    submitBtn.disabled = !enabled;
    submitBtn.classList.toggle('is-disabled', !enabled);
  }

  function setSubmitting(form) {
    const submitBtn = form.querySelector('button[type="submit"]');
    if (!submitBtn) return;

    submitBtn.dataset.originalText = submitBtn.textContent;
    submitBtn.textContent = 'Memproses...';
    submitBtn.disabled = true;
    submitBtn.classList.add('is-loading');
  }

  function addPasswordToggle(form) {
    form.querySelectorAll('input[type="password"]').forEach((input) => {
      if (!input.parentElement || input.parentElement.classList.contains('password-wrap')) return;

      const wrap = document.createElement('div');
      wrap.className = 'password-wrap';
      input.parentElement.insertBefore(wrap, input);
      wrap.appendChild(input);

      const toggleBtn = document.createElement('button');
      toggleBtn.type = 'button';
      toggleBtn.className = 'toggle-password-btn';
      toggleBtn.textContent = 'Lihat';

      toggleBtn.addEventListener('click', () => {
        const isHidden = input.type === 'password';
        input.type = isHidden ? 'text' : 'password';
        toggleBtn.textContent = isHidden ? 'Sembunyi' : 'Lihat';
      });

      wrap.appendChild(toggleBtn);
    });
  }

  function wireRegister(form) {
    addPasswordToggle(form);

    const watched = ['name', 'email', 'phone', 'password', 'confirm_password', 'terms'];
    watched.forEach((name) => {
      const field = form.querySelector(`[name="${name}"]`);
      if (!field) return;

      const eventName = field.type === 'checkbox' ? 'change' : 'input';
      field.addEventListener(eventName, () => {
        const valid = validateRegister(form);
        setSubmitState(form, valid);
      });
    });

    const initialValid = validateRegister(form);
    setSubmitState(form, initialValid);

    form.addEventListener('submit', (event) => {
      const valid = validateRegister(form);
      if (!valid) {
        event.preventDefault();
        setSubmitState(form, false);
        return;
      }

      setSubmitting(form);
    });
  }

  function wireLogin(form) {
    addPasswordToggle(form);

    ['email', 'password'].forEach((name) => {
      const field = form.querySelector(`[name="${name}"]`);
      if (!field) return;

      field.addEventListener('input', () => {
        const valid = validateLogin(form);
        setSubmitState(form, valid);
      });
    });

    const initialValid = validateLogin(form);
    setSubmitState(form, initialValid);

    form.addEventListener('submit', (event) => {
      const valid = validateLogin(form);
      if (!valid) {
        event.preventDefault();
        setSubmitState(form, false);
        return;
      }

      setSubmitting(form);
    });
  }

  if (registerForm) wireRegister(registerForm);
  if (loginForm) wireLogin(loginForm);
})();
