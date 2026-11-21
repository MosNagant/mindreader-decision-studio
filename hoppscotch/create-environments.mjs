import {mkdir, writeFile} from 'node:fs/promises';

const directory = new URL('./local/', import.meta.url);
await mkdir(directory, {recursive: true});
const presets = [
  ['entry', 'MindReader 完整新测试', ['webhook_url']],
  ['split', 'MindReader 三场景测试', ['start_game_url', 'submit_choice_url', 'generate_profile_url']]
];
for (const [file, name, keys] of presets) {
  const variables = [
    ...keys.map(key => ({key, value: '', secret: true})),
    {key: 'choice', value: 'B', secret: false},
    {key: 'difficulty_level', value: '2', secret: false},
    {key: 'scenario_topic', value: 'workplace', secret: false}
  ];
  const path = new URL(file + '.environment.json', directory);
  try {
    await writeFile(path, JSON.stringify({name, variables}, null, 2) + '\n', {flag: 'wx', mode: 0o600});
    console.log('已创建', path.pathname);
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    console.log('已保留现有文件', path.pathname);
  }
}
