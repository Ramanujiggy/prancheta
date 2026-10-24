// Ready-made classes a coach can start from. Each one follows the same
// structure and is written the way you'd brief it on the mat.

import { firstOf, fromLegacy, item, legacyBlank, move, samplePlan, type ClassPlan } from './plan.ts';
import { getLang } from './i18n.ts';

export interface Template {
  key: string;
  title: string;
  level: 'Fundamentals' | 'All levels' | 'Advanced';
  blurb: string;
  build: (now?: Date) => ClassPlan;
}

interface Spec {
  title: string;
  drills: string[];
  rule: string;
  ruleNotes: string;
  start: string;
  objective: string;
  goals: string[];
  details: string[];
  transition: string;
  submission: string;
  moves: [string, string][];
  options: string[];
  freeRollNotes?: string;
}

function fromSpec(s: Spec, now = new Date()): ClassPlan {
  const p = legacyBlank(now);
  return fromLegacy({
    ...p,
    title: s.title,
    warmup: { ...p.warmup, drills: s.drills.map(item) },
    concept: { ...p.concept, rule: s.rule, notes: s.ruleNotes },
    game: {
      ...p.game,
      start: s.start,
      objective: s.objective,
      goals: s.goals.map(item),
      details: s.details.map(item),
      transition: s.transition,
      submission: s.submission,
    },
    gems: { ...p.gems, moves: s.moves.map(([n, d]) => move(n, d)), options: s.options.map(item) },
    freeRoll: { ...p.freeRoll, notes: s.freeRollNotes ?? '' },
  });
}

const closedGuard: Spec = {
  title: 'Closed guard: break posture first',
  drills: ['Shrimps', 'Bridges', 'Hip escapes to knees', 'Technical stand-ups', 'Granby rolls'],
  rule: 'Break the posture before you attack.',
  ruleNotes: 'A postured opponent can defend everything. Bring the head down and the attacks open up.',
  start: 'Closed guard',
  objective: 'Sweep or submit',
  goals: [
    'Bottom: break posture and keep it broken',
    'Top: posture up and open the guard',
    'Reset if top opens the guard and passes the knee line',
  ],
  details: [
    'Pull with the legs, not just the arms',
    'Control one sleeve and the collar or head',
    'Angle off before you attack. Never attack from square',
  ],
  transition: 'Broken posture → hip bump sweep to mount',
  submission: 'Kimura or guillotine off the hip bump',
  moves: [
    ['Hip bump sweep', 'Sit up into them when they posture. Post the hand, bump the hip, follow to mount.'],
    ['Kimura from the bump', 'They post the arm to stop the sweep. Catch the wrist, figure-four, fall back to an angle.'],
  ],
  options: ['Guillotine if they drop the head', 'Flower sweep if they push off to stand'],
};

const halfGuard: Spec = {
  title: 'Half guard: win the underhook',
  drills: ['Shrimps', 'Forward shrimps', 'Sit-throughs', 'Bear crawls', 'Granby rolls'],
  rule: 'In half guard, whoever owns the underhook owns the position.',
  ruleNotes: 'Bottom wants the underhook to come up. Top wants it to flatten them.',
  start: 'Half guard',
  objective: 'Come up to the back or a single leg',
  goals: [
    'Bottom: win the underhook and get to your side',
    'Top: crossface, flatten, and win the underhook yourself',
    'Reset if bottom is flattened with the crossface in',
  ],
  details: [
    'Underhook high on the back, not on the hip',
    'Head on their chest, never on the mat',
    'Knee shield frames until the underhook is in',
  ],
  transition: 'Underhook → dogfight → back take',
  submission: 'Rear naked choke once the hooks are in',
  moves: [
    ['Old school sweep', 'From the underhook, reach for the far ankle and drive into them with the head.'],
    ['Dogfight to the back', 'Come up on the knee, run around as they sprawl, seatbelt and hook.'],
  ],
  options: ['Single leg finish if they stand', 'Switch to deep half if they crossface hard'],
};

const backControl: Spec = {
  title: 'Back control: hands before the choke',
  drills: ['Forward rolls', 'Backward rolls', 'Shrimps', 'Hip switches', 'Bridges'],
  rule: 'Win the hand fight before you go for the choke.',
  ruleNotes: 'Chasing the neck against two hands loses the back. Clear a hand, then finish.',
  start: 'Back control with seatbelt',
  objective: 'Finish the choke',
  goals: [
    'Top: keep the seatbelt and hooks, trap or clear a hand',
    'Bottom: two-on-one the choking arm and slide to the mat',
    'Reset if bottom gets shoulders to the mat',
  ],
  details: [
    'Choke side under, but chest glued to their back',
    'Use the hook on the trapped side to pin the arm',
    'Fall to the choking-arm side, never the other one',
  ],
  transition: 'Seatbelt → body triangle when hooks are threatened',
  submission: 'Rear naked choke or bow and arrow',
  moves: [
    ['Arm trap to choke', 'Leg pins the bottom arm. Now one hand is free against one hand.'],
    ['Bow and arrow', 'Feed the collar, grab the pants, swing the leg over, pull apart.'],
  ],
  options: ['Armbar when they over-defend the neck', 'Mount if they turn into you'],
};

const mountEscapes: Spec = {
  title: 'Mount escapes for fundamentals',
  drills: ['Bridges', 'Shrimps', 'Forward shrimps', 'Technical stand-ups', 'Bear crawls'],
  rule: 'Frame first, then move your hips. Never push with straight arms.',
  ruleNotes: 'Frames create space. Hips use it. Arms that push get armbarred.',
  start: 'Mount',
  objective: 'Escape to guard or come up on top',
  goals: [
    'Bottom: frame, bridge, and get a knee back inside',
    'Top: stay heavy, keep the knees tight, climb high',
    'Reset when bottom gets half guard or better',
  ],
  details: [
    'Elbows tight, forearm frame across the hip',
    'Bridge to one side before you shrimp to the other',
    'Trap the arm and foot on the same side for the upa',
  ],
  transition: 'Elbow-knee escape → half guard → full guard',
  submission: 'None from bottom today. Keep your arms safe.',
  moves: [
    ['Upa (trap and roll)', 'Trap the arm and foot on one side, bridge over your shoulder, land in their guard.'],
    ['Elbow-knee escape', 'Frame, bridge, shrimp, and slide the knee inside. Repeat to the other side.'],
  ],
  options: ['Upa when they post a hand', 'Elbow-knee when they post a foot'],
  freeRollNotes: 'Beginners start from mount bottom and switch every round.',
};

const closedGuardPt: Spec = {
  title: 'Guarda fechada: quebre a postura primeiro',
  drills: ['Fuga de quadril', 'Ponte', 'Fuga de quadril até os joelhos', 'Levantada técnica', 'Rolamento granby'],
  rule: 'Quebre a postura antes de atacar.',
  ruleNotes: 'Com postura, o adversário defende tudo. Traga a cabeça dele para baixo e os ataques aparecem.',
  start: 'Guarda fechada',
  objective: 'Raspar ou finalizar',
  goals: [
    'Por baixo: quebre a postura e mantenha quebrada',
    'Por cima: recupere a postura e abra a guarda',
    'Recomeça se quem está por cima abrir a guarda e passar da linha do joelho',
  ],
  details: [
    'Puxe com as pernas, não só com os braços',
    'Controle uma manga e a gola ou a cabeça',
    'Busque o ângulo antes de atacar. Nunca ataque de frente',
  ],
  transition: 'Postura quebrada → raspagem de quadril para a montada',
  submission: 'Kimura ou guilhotina a partir da raspagem de quadril',
  moves: [
    ['Raspagem de quadril', 'Quando ele recuperar a postura, sente para cima dele. Apoie a mão, empurre com o quadril e vá para a montada.'],
    ['Kimura a partir da raspagem', 'Ele apoia o braço para segurar a raspagem. Pegue o punho, feche a figura quatro e caia em ângulo.'],
  ],
  options: ['Guilhotina se ele abaixar a cabeça', 'Raspagem pêndulo se ele empurrar para levantar'],
};

const halfGuardPt: Spec = {
  title: 'Meia-guarda: ganhe o underhook',
  drills: ['Fuga de quadril', 'Fuga de quadril para frente', 'Sit-through', 'Andar de urso', 'Rolamento granby'],
  rule: 'Na meia-guarda, quem tem o underhook manda na posição.',
  ruleNotes: 'Quem está por baixo quer o underhook para subir. Quem está por cima quer ele para achatar.',
  start: 'Meia-guarda',
  objective: 'Subir para as costas ou numa single leg',
  goals: [
    'Por baixo: ganhe o underhook e fique de lado',
    'Por cima: crossface, achate e ganhe o underhook você',
    'Recomeça se quem está por baixo for achatado com o crossface encaixado',
  ],
  details: [
    'Underhook alto nas costas, não no quadril',
    'Cabeça no peito dele, nunca no chão',
    'Joelho na frente como escudo até o underhook entrar',
  ],
  transition: 'Underhook → dogfight → pegada de costas',
  submission: 'Mata-leão depois que os ganchos entram',
  moves: [
    ['Raspagem old school', 'Do underhook, alcance o tornozelo de longe e empurre com a cabeça.'],
    ['Dogfight para as costas', 'Suba no joelho, gire por trás quando ele fizer sprawl, pegada de cinto e gancho.'],
  ],
  options: ['Termine a single leg se ele levantar', 'Troque para a meia-guarda profunda se ele apertar o crossface'],
};

const backControlPt: Spec = {
  title: 'Controle das costas: mãos antes do estrangulamento',
  drills: ['Rolamento para frente', 'Rolamento para trás', 'Fuga de quadril', 'Troca de quadril', 'Ponte'],
  rule: 'Ganhe a briga de mãos antes de ir para o estrangulamento.',
  ruleNotes: 'Correr atrás do pescoço contra duas mãos faz você perder as costas. Tire uma mão, depois finalize.',
  start: 'Costas com pegada de cinto',
  objective: 'Finalizar no estrangulamento',
  goals: [
    'Por cima: mantenha a pegada de cinto e os ganchos, prenda ou tire uma mão',
    'Por baixo: duas mãos no braço que estrangula e deslize para o chão',
    'Recomeça se quem está por baixo encostar os ombros no chão',
  ],
  details: [
    'Braço do estrangulamento por baixo, mas o peito colado nas costas dele',
    'Use o gancho do lado preso para segurar o braço',
    'Caia para o lado do braço que estrangula, nunca para o outro',
  ],
  transition: 'Pegada de cinto → triângulo de corpo quando os ganchos estiverem ameaçados',
  submission: 'Mata-leão ou arco e flecha',
  moves: [
    ['Prender o braço para estrangular', 'A perna prende o braço de baixo. Agora é uma mão livre contra uma.'],
    ['Arco e flecha', 'Passe a gola, pegue a calça, passe a perna por cima e puxe para os lados.'],
  ],
  options: ['Chave de braço quando ele defende demais o pescoço', 'Montada se ele virar para você'],
};

const mountEscapesPt: Spec = {
  title: 'Saídas da montada para iniciantes',
  drills: ['Ponte', 'Fuga de quadril', 'Fuga de quadril para frente', 'Levantada técnica', 'Andar de urso'],
  rule: 'Primeiro o enquadramento, depois o quadril. Nunca empurre com o braço esticado.',
  ruleNotes: 'O enquadramento cria espaço. O quadril usa esse espaço. Braço que empurra leva chave de braço.',
  start: 'Montada',
  objective: 'Recuperar a guarda ou inverter por cima',
  goals: [
    'Por baixo: enquadre, faça a ponte e coloque um joelho de volta para dentro',
    'Por cima: fique pesado, joelhos fechados, suba alto',
    'Recomeça quando quem está por baixo conseguir a meia-guarda ou melhor',
  ],
  details: [
    'Cotovelos fechados, antebraço enquadrando no quadril',
    'Ponte para um lado antes de fazer a fuga de quadril para o outro',
    'Prenda o braço e o pé do mesmo lado para o upa',
  ],
  transition: 'Fuga cotovelo-joelho → meia-guarda → guarda fechada',
  submission: 'Nenhuma por baixo hoje. Proteja os braços.',
  moves: [
    ['Upa', 'Prenda o braço e o pé de um lado, faça a ponte por cima do ombro e caia na guarda dele.'],
    ['Fuga cotovelo-joelho', 'Enquadre, ponte, fuga de quadril e coloque o joelho para dentro. Repita do outro lado.'],
  ],
  options: ['Upa quando ele apoia uma mão', 'Cotovelo-joelho quando ele apoia um pé'],
  freeRollNotes: 'Iniciantes começam por baixo da montada e trocam a cada round.',
};

const EXAMPLES: { key: string; level: Template['level']; en: Spec | null; pt: Spec | null }[] = [
  { key: 'leg-drag', level: 'All levels', en: null, pt: null },
  { key: 'closed-guard', level: 'Fundamentals', en: closedGuard, pt: closedGuardPt },
  { key: 'half-guard', level: 'All levels', en: halfGuard, pt: halfGuardPt },
  { key: 'back-control', level: 'Advanced', en: backControl, pt: backControlPt },
  { key: 'mount-escapes', level: 'Fundamentals', en: mountEscapes, pt: mountEscapesPt },
];

/** The ready-made classes, written in the app's language. */
export function templates(): Template[] {
  const pt = getLang() === 'pt';
  return EXAMPLES.map(({ key, level, en, pt: ptSpec }) => {
    const spec = pt ? ptSpec : en;
    if (!spec) {
      // The leg drag class is the app's own example, kept in plan.ts.
      const sample = samplePlan();
      return { key, level, title: sample.title, blurb: firstOf(sample, 'concept')?.rule ?? '', build: samplePlan };
    }
    return { key, level, title: spec.title, blurb: spec.rule, build: (now?: Date) => fromSpec(spec, now) };
  });
}
