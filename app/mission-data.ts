export type MissionToolName = "set_waypoint" | "remember_fact" | "give_item" | "complete_step";

export type AgentAction = {
  tool: MissionToolName;
  value: string;
  reason?: string;
};

export type MissionStep = {
  id: string;
  npcIndex: number;
  title: string;
  instruction: string;
  handoff: string;
  reward: string;
};

export type CityMission = {
  id: string;
  title: string;
  summary: string;
  finale: string;
  steps: [MissionStep, MissionStep, MissionStep];
};

export const FLAGSHIP_MISSIONS: Record<string, CityMission> = {
  "new-york": {
    id: "nyc-local-plan",
    title: "A New York minute",
    summary: "Tell a cab driver where you are going, ride to a Midtown cafe, and order like a local.",
    finale: "You handled a New York cab ride, cafe order, and local follow-up.",
    steps: [
      {
        id: "cab-to-cafe",
        npcIndex: 1,
        title: "Tell the driver",
        instruction: "Tell Theo you want to go to Midtown Cafe and Deli, then confirm the destination or fare.",
        handoff: "Theo's confirmed cafe ride",
        reward: "Yellow cab receipt",
      },
      {
        id: "deli-order",
        npcIndex: 0,
        title: "Order at the cafe",
        instruction: "Ask Maya for a coffee and a classic New York bite, then confirm the order.",
        handoff: "Maya's Midtown cafe recommendation",
        reward: "New York cafe stamp",
      },
      {
        id: "park-plan",
        npcIndex: 2,
        title: "Finish the plan",
        instruction: "Use Theo's route with Jordan, then ask what New Yorkers do here after work.",
        handoff: "Jordan's after-work tip",
        reward: "NYC local badge",
      },
    ],
  },
  madrid: {
    id: "madrid-cafe-hop",
    title: "Cafe, cab, and El Rastro",
    summary: "Tell a taxi driver where you are going, ride to Cafe Lucia, and order in Spanish.",
    finale: "You crossed Madrid using practical Spanish for the taxi, cafe, and market.",
    steps: [
      {
        id: "madrid-taxi",
        npcIndex: 1,
        title: "Tell the driver",
        instruction: "Tell Mateo you want to go to Cafe Lucia, then confirm the destination, fare, or journey time in Spanish.",
        handoff: "Mateo's confirmed cafe ride",
        reward: "Madrid taxi receipt",
      },
      {
        id: "madrid-cafe",
        npcIndex: 0,
        title: "Order at the cafe",
        instruction: "Greet Lucia, order a coffee and something small, then confirm the price in Spanish.",
        handoff: "Lucia's cafe recommendation",
        reward: "Madrid cafe stamp",
      },
      {
        id: "madrid-market",
        npcIndex: 2,
        title: "Browse like a local",
        instruction: "Ask Sofia about one local item, understand the price, and respond naturally.",
        handoff: "Sofia's market tip",
        reward: "Madrid local badge",
      },
    ],
  },
  paris: {
    id: "paris-sunset-gift",
    title: "A gift before sunset",
    summary: "Order at the cafe, follow a bookseller's directions, and buy a small market gift.",
    finale: "You completed a Paris errand using polite French across three connected encounters.",
    steps: [
      {
        id: "cafe-clue",
        npcIndex: 0,
        title: "Start at the cafe",
        instruction: "Order from Camille politely and ask where to find a thoughtful local gift.",
        handoff: "Camille's gift suggestion",
        reward: "Cafe receipt",
      },
      {
        id: "bookseller-directions",
        npcIndex: 1,
        title: "Follow the Seine",
        instruction: "Mention Camille to Luc and ask for clear directions to the street market.",
        handoff: "Luc's market directions",
        reward: "Marked bookstall map",
      },
      {
        id: "market-purchase",
        npcIndex: 2,
        title: "Choose the gift",
        instruction: "Ask Amelie the price, choose an item, and confirm how you would like to pay.",
        handoff: "Amelie's market recommendation",
        reward: "Paris keepsake",
      },
    ],
  },
  mumbai: {
    id: "mumbai-market-run",
    title: "The monsoon market run",
    summary: "Tell a cab driver where you are going, ride to an Irani cafe, and order in Marathi.",
    finale: "You crossed Mumbai through cab, cafe, and market conversations in Marathi.",
    steps: [
      {
        id: "mumbai-cab",
        npcIndex: 1,
        title: "Tell the driver",
        instruction: "Tell Rohan you want to go to the Irani cafe, then confirm the destination, pickup, or fare in Marathi.",
        handoff: "Rohan's confirmed cafe ride",
        reward: "Black-and-yellow cab receipt",
      },
      {
        id: "irani-cafe",
        npcIndex: 0,
        title: "Order at the cafe",
        instruction: "Ask Ira for cutting chai and bun maska, then confirm the order in Marathi.",
        handoff: "Ira's cafe order",
        reward: "Mumbai cafe stamp",
      },
      {
        id: "dadar-market",
        npcIndex: 2,
        title: "Complete the errand",
        instruction: "Ask Sahil for an item, understand the price, and respond naturally.",
        handoff: "Sahil's market tip",
        reward: "Mumbai local badge",
      },
    ],
  },
};

export function genericMission(cityId: string, cityName: string, goals: string[]): CityMission {
  return {
    id: `${cityId}-street-intro`,
    title: `${cityName} street run`,
    summary: "Meet three locals and complete one useful exchange with each of them.",
    finale: `You completed the ${cityName} street run.`,
    steps: goals.slice(0, 3).map((goal, index) => ({
      id: `street-${index + 1}`,
      npcIndex: index,
      title: [`Meet a local`, `Handle the details`, `Ask like a regular`][index],
      instruction: goal,
      handoff: `Conversation ${index + 1} insight`,
      reward: [`Local introduction`, `Useful direction`, `${cityName} badge`][index],
    })) as CityMission["steps"],
  };
}
