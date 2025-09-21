export interface Header {
  /** Currently only version 2 is supported */
  version: number
  width: number
  height: number

  timestamp?: number
  duration?: number
  idle_time_limit?: number
  command?: string
  title?: string
  env?: Record<string, string>
  theme?: {
    fg?: string
    bg?: string
    palette?: string
  }
}

export const EventTypeOutput = "o";
export const EventTypeInput = "i";
export const EventTypeResize = "r";
export const EventTypeMarker = "m";
export const EventTypeQuit = "q";

/**
  Represents any kind of event

  @member timestamp is time since start of recording in seconds (float)
*/
export type Event<T = string, D = any> = [
  timestamp: number,
  type: T,
  data: D
];
// export type EventOutput = Event<"o", string>;
// export type EventInput = Event<"i", string>;

// /**
//   Data is in format 'WxH' where 'W' and 'H' are new width and height of the terminal
// */
// export type EventResize = Event<"r", string>;
