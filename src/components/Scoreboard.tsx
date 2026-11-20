import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { EyeOff, Trophy } from 'lucide-react';
import { MAX_TEAM_NAME_LENGTH, TEAM_COUNT, type TeamIndex } from '../types';

interface TeamNameInputProps {
  name: string;
  teamIndex: TeamIndex;
  onRename: (teamIndex: TeamIndex, newName: string) => void;
}

function TeamNameInput({ name, teamIndex, onRename }: TeamNameInputProps) {
  const [draftName, setDraftName] = useState(name);
  useEffect(() => setDraftName(name), [name]);

  return (
    <input
      className="team__name"
      value={draftName}
      maxLength={MAX_TEAM_NAME_LENGTH}
      placeholder={`Команда ${teamIndex + 1}`}
      aria-label={`Название команды ${teamIndex + 1}`}
      title="Нажмите, чтобы переименовать"
      onChange={(event) => setDraftName(event.target.value)}
      onBlur={() => {
        if (draftName.trim() !== name) onRename(teamIndex, draftName);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur();
        if (event.key === 'Escape') {
          setDraftName(name);
          event.currentTarget.blur();
        }
      }}
    />
  );
}

interface ScoreboardProps {
  teamNames: string[];
  scores: number[];
  onRenameTeam: (teamIndex: TeamIndex, newName: string) => void;
}

/** Host-only scoreboard. Data lives in the private Firestore doc, so players can never load it. */
export function Scoreboard({ teamNames, scores, onRenameTeam }: ScoreboardProps) {
  const topScore = Math.max(...scores);
  const hasLeader = scores.filter((score) => score === topScore).length === 1 && topScore > 0;

  return (
    <section className="scoreboard" aria-label="Табло (видно только ведущему)">
      {Array.from({ length: TEAM_COUNT }, (_, index) => {
        const teamIndex = index as TeamIndex;
        const score = scores[teamIndex] ?? 0;
        const isLeader = hasLeader && score === topScore;
        return (
          <div key={teamIndex} className={`team team--${teamIndex}${isLeader ? ' team--leader' : ''}`}>
            <span className="team__marker" aria-hidden />
            <TeamNameInput name={teamNames[teamIndex] ?? ''} teamIndex={teamIndex} onRename={onRenameTeam} />
            {isLeader && <Trophy size={18} className="team__trophy" aria-label="Лидер" />}
            <motion.span
              key={score}
              className="team__score"
              initial={{ scale: 1.25, opacity: 0.4 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 400, damping: 22 }}
            >
              {score}
            </motion.span>
          </div>
        );
      })}
      <span className="scoreboard__private">
        <EyeOff size={14} aria-hidden /> Табло видите только вы
      </span>
    </section>
  );
}
