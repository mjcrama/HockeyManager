import { useState } from 'react';
import { useAppState, useAppDispatch } from '../context/AppContext';
import type { Player, Position } from '../types';

const ALL_POSITIONS: Position[] = [
  'GK', 'LB', 'CB', 'RB', 'LM', 'CM', 'RM', 'LF', 'CF', 'RF', 'DEF', 'MID', 'FWD',
];

interface PlayerFormData {
  name: string;
  jerseyNumber: string;
  preferredPositions: Position[];
}

const emptyForm: PlayerFormData = {
  name: '',
  jerseyNumber: '',
  preferredPositions: [],
};

function PlayerForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: PlayerFormData;
  onSave: (data: PlayerFormData) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<PlayerFormData>(initial ?? emptyForm);
  const [errors, setErrors] = useState<Partial<PlayerFormData>>({});

  function validate(): boolean {
    const newErrors: Partial<PlayerFormData> = {};
    if (!form.name.trim()) newErrors.name = 'Naam is verplicht';
    if (!form.jerseyNumber || isNaN(Number(form.jerseyNumber)) || Number(form.jerseyNumber) < 1) {
      newErrors.jerseyNumber = 'Geldig rugnummer vereist';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (validate()) onSave(form);
  }

  function togglePosition(pos: Position) {
    setForm((prev) => ({
      ...prev,
      preferredPositions: prev.preferredPositions.includes(pos)
        ? prev.preferredPositions.filter((p) => p !== pos)
        : [...prev.preferredPositions, pos],
    }));
  }

  return (
    <form className="player-form" onSubmit={handleSubmit}>
      <div className="player-form__field">
        <label className="player-form__label">Naam</label>
        <input
          className={`player-form__input${errors.name ? ' player-form__input--error' : ''}`}
          type="text"
          value={form.name}
          onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
          placeholder="Spelernaam"
        />
        {errors.name && <span className="player-form__error">{errors.name}</span>}
      </div>

      <div className="player-form__field">
        <label className="player-form__label">Rugnummer</label>
        <input
          className={`player-form__input${errors.jerseyNumber ? ' player-form__input--error' : ''}`}
          type="number"
          min={1}
          max={99}
          value={form.jerseyNumber}
          onChange={(e) => setForm((prev) => ({ ...prev, jerseyNumber: e.target.value }))}
          placeholder="e.g. 7"
        />
        {errors.jerseyNumber && <span className="player-form__error">{errors.jerseyNumber}</span>}
      </div>

      <div className="player-form__field">
        <label className="player-form__label">Voorkeursposities</label>
        <div className="player-form__positions">
          {ALL_POSITIONS.map((pos) => (
            <button
              key={pos}
              type="button"
              className={`player-form__pos-btn${form.preferredPositions.includes(pos) ? ' player-form__pos-btn--active' : ''}`}
              onClick={() => togglePosition(pos)}
            >
              {pos}
            </button>
          ))}
        </div>
      </div>

      <div className="player-form__actions">
        <button type="submit" className="btn btn--primary">
          Opslaan
        </button>
        <button type="button" className="btn btn--ghost" onClick={onCancel}>
          Annuleren
        </button>
      </div>
    </form>
  );
}

export function PlayerManager() {
  const { players } = useAppState();
  const dispatch = useAppDispatch();
  const [showForm, setShowForm] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  function handleAddPlayer(data: PlayerFormData) {
    dispatch({
      type: 'ADD_PLAYER',
      payload: {
        name: data.name.trim(),
        jerseyNumber: Number(data.jerseyNumber),
        preferredPositions: data.preferredPositions,
        available: true,
      },
    });
    setShowForm(false);
  }

  function handleEditPlayer(data: PlayerFormData) {
    if (!editingPlayer) return;
    dispatch({
      type: 'UPDATE_PLAYER',
      payload: {
        ...editingPlayer,
        name: data.name.trim(),
        jerseyNumber: Number(data.jerseyNumber),
        preferredPositions: data.preferredPositions,
      },
    });
    setEditingPlayer(null);
  }

  function handleDelete(id: string) {
    dispatch({ type: 'DELETE_PLAYER', payload: id });
    setDeleteConfirmId(null);
    setEditingPlayer(null);
  }

  const sortedPlayers = [...players].sort((a, b) => a.jerseyNumber - b.jerseyNumber);

  return (
    <div className="player-manager">
      <div className="player-manager__header">
        <h2 className="player-manager__title">Team Selectie</h2>
        <button
          className="btn btn--primary"
          onClick={() => {
            setShowForm(true);
            setEditingPlayer(null);
          }}
        >
          + Speler toevoegen
        </button>
      </div>

      {(showForm || editingPlayer) && (
        <div className="player-manager__form-wrapper">
          <h3 className="player-manager__form-title">
            {editingPlayer ? 'Speler bewerken' : 'Nieuwe speler'}
          </h3>
          <PlayerForm
            initial={
              editingPlayer
                ? {
                    name: editingPlayer.name,
                    jerseyNumber: String(editingPlayer.jerseyNumber),
                    preferredPositions: editingPlayer.preferredPositions,
                  }
                : undefined
            }
            onSave={editingPlayer ? handleEditPlayer : handleAddPlayer}
            onCancel={() => {
              setShowForm(false);
              setEditingPlayer(null);
            }}
          />
          {editingPlayer && (
            <div className="player-manager__delete-section">
              {deleteConfirmId === editingPlayer.id ? (
                <>
                  <button className="btn btn--danger btn--sm" onClick={() => handleDelete(editingPlayer.id)}>
                    Verwijderen bevestigen
                  </button>
                  <button className="btn btn--ghost btn--sm" onClick={() => setDeleteConfirmId(null)}>
                    Annuleren
                  </button>
                </>
              ) : (
                <button className="btn btn--ghost btn--sm" onClick={() => setDeleteConfirmId(editingPlayer.id)}>
                  🗑️ Speler verwijderen
                </button>
              )}
            </div>
          )}
        </div>
      )}

      <div className="player-manager__stats">
        <span className="player-manager__stat">
          Total: <strong>{players.length}</strong>
        </span>
        <span className="player-manager__stat">
          Beschikbaar: <strong>{players.filter((p) => p.available).length}</strong>
        </span>
        <span className="player-manager__stat">
          Niet beschikbaar: <strong>{players.filter((p) => !p.available).length}</strong>
        </span>
      </div>

      {players.length === 0 ? (
        <div className="player-manager__empty">
          <p>Nog geen spelers. Voeg je eerste speler toe!</p>
        </div>
      ) : (
        <div className="player-list">
          {sortedPlayers.map((player) => (
            <div
              key={player.id}
              role="button"
              tabIndex={0}
              style={{ cursor: 'pointer' }}
              className={`player-card${!player.available ? ' player-card--unavailable' : ''}`}
              onClick={() => { setEditingPlayer(player); setShowForm(false); }}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { setEditingPlayer(player); setShowForm(false); } }}
            >
              <div className="player-card__jersey">
                <span className="player-card__number">#{player.jerseyNumber}</span>
              </div>

              <div className="player-card__info">
                <span className="player-card__name">{player.name}</span>
                {player.preferredPositions.length > 0 && (
                  <div className="player-card__positions">
                    {player.preferredPositions.map((pos) => (
                      <span key={pos} className="player-card__pos-tag">
                        {pos}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="player-card__actions" onClick={(e) => e.stopPropagation()}>
                <button
                  className={`availability-toggle${player.available ? ' availability-toggle--available' : ' availability-toggle--unavailable'}`}
                  onClick={() => dispatch({ type: 'TOGGLE_AVAILABILITY', payload: player.id })}
                  title={player.available ? 'Markeer niet beschikbaar' : 'Markeer beschikbaar'}
                >
                  {player.available ? 'Beschikbaar' : 'Niet beschikbaar'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
