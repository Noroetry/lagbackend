function formatQuestsPayload(questsOrQuest) {
  if (!questsOrQuest) return { quests: [] };
  if (Array.isArray(questsOrQuest)) return { quests: questsOrQuest };
  return { quests: [questsOrQuest] };
}

module.exports = { formatQuestsPayload };