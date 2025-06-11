const {Plugin, PluginSettingTab, Setting, TFile, Modal} = require('obsidian');

const DEFAULT_SETTINGS = {
  openAIApiKey: '',
  rulesFile: '',
  history: []
};

module.exports = class CTreePlugin extends Plugin {
  async onload() {
    console.log('Loading C-tree AI plugin');
    await this.loadSettings();
    this.addCommand({
      id: 'ctree-open-conversation',
      name: 'Open AI Conversation',
      callback: () => new ConversationModal(this.app, this).open()
    });
    this.addSettingTab(new CTreeSettingTab(this.app, this));
  }

  onunload() {
    console.log('Unloading C-tree AI plugin');
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  async loadRules() {
    if (!this.settings.rulesFile) return '';
    const f = this.app.vault.getAbstractFileByPath(this.settings.rulesFile);
    if (f instanceof TFile) {
      return await this.app.vault.read(f);
    }
    return '';
  }

  async fetchFromAI(prompt) {
    const rules = await this.loadRules();
    const messages = [
      {role: 'system', content: rules},
      {role: 'user', content: prompt}
    ];
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.settings.openAIApiKey}`
      },
      body: JSON.stringify({model: 'gpt-4o', messages})
    });
    const data = await res.json();
    const reply = data.choices?.[0]?.message?.content?.trim() || '';
    if (this.settings.history[this.settings.history.length - 1] !== reply) {
      this.settings.history.push(reply);
      await this.saveSettings();
    }
    return reply;
  }
};

class ConversationModal extends Modal {
  constructor(app, plugin) {
    super(app);
    this.plugin = plugin;
  }
  onOpen() {
    const {contentEl} = this;
    contentEl.empty();
    contentEl.createEl('h2', {text: 'C-tree AI'});
    const input = contentEl.createEl('textarea');
    const runBtn = contentEl.createEl('button', {text: 'Run'});
    const output = contentEl.createEl('pre');
    const label = contentEl.createEl('label');
    const check = label.createEl('input', {type: 'checkbox'});
    label.appendText('Apply suggestion');
    runBtn.addEventListener('click', async () => {
      const result = await this.plugin.fetchFromAI(input.value);
      output.textContent = result;
    });
    check.addEventListener('change', () => {
      if (check.checked) this.close();
    });
  }
}

class CTreeSettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const {containerEl} = this;
    containerEl.empty();
    new Setting(containerEl)
      .setName('OpenAI API Key')
      .addText(text => text
        .setPlaceholder('sk-...')
        .setValue(this.plugin.settings.openAIApiKey)
        .onChange(async val => {
          this.plugin.settings.openAIApiKey = val;
          await this.plugin.saveSettings();
        }));
    new Setting(containerEl)
      .setName('Rules file path')
      .addText(text => text
        .setValue(this.plugin.settings.rulesFile)
        .onChange(async val => {
          this.plugin.settings.rulesFile = val;
          await this.plugin.saveSettings();
        }));
  }
}

