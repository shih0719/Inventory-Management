// 国际化管理
const i18n = {
  currentLanguage: localStorage.getItem('lang') || 'zh-TW',
  messages: {},

  async init() {
    // 加载所有语言文件
    const languages = ['en', 'zh-TW', 'ja'];
    for (const lang of languages) {
      try {
        const response = await fetch(`/src/i18n/${lang}.json`);
        this.messages[lang] = await response.json();
      } catch (error) {
        console.error(`Failed to load language file: ${lang}`, error);
      }
    }

    // 应用当前语言
    this.applyLanguage(this.currentLanguage);
    console.log(`✓ i18n initialized with language: ${this.currentLanguage}`);
  },

  // 获取翻译文本
  t(key) {
    const keys = key.split('.');
    let value = this.messages[this.currentLanguage];

    for (const k of keys) {
      value = value?.[k];
    }

    return value || key; // 如果找不到翻译，返回 key
  },

  // 切换语言
  setLanguage(lang) {
    if (this.messages[lang]) {
      this.currentLanguage = lang;
      localStorage.setItem('lang', lang);
      this.applyLanguage(lang);
      window.location.reload(); // 刷新页面以应用所有文本更改
    }
  },

  // 应用语言到 DOM
  applyLanguage(lang) {
    document.documentElement.lang = lang;

    // 更新所有有 data-i18n 属性的元素
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      const text = this.t(key);

      // 如果是表单元素，更新 placeholder
      if (el.placeholder !== undefined) {
        el.placeholder = text;
      } else if (el.value !== undefined && el.type !== 'button' && el.type !== 'submit') {
        // 不改变 input 的 value
      } else {
        // 更新文本内容
        el.textContent = text;
      }
    });

    // 更新 button 的值
    document.querySelectorAll('button[data-i18n]').forEach(btn => {
      const key = btn.getAttribute('data-i18n');
      btn.textContent = this.t(key);
    });

    // 更新 label
    document.querySelectorAll('label[data-i18n]').forEach(label => {
      const key = label.getAttribute('data-i18n');
      label.textContent = this.t(key);
    });
  },

  // 获取所有支持的语言
  getLanguages() {
    return [
      { code: 'zh-TW', name: '繁體中文', flag: '🇹🇼' },
      { code: 'en', name: 'English', flag: '🇺🇸' },
      { code: 'ja', name: '日本語', flag: '🇯🇵' }
    ];
  },

  // 获取当前语言
  getCurrentLanguage() {
    return this.currentLanguage;
  }
};

export { i18n };
