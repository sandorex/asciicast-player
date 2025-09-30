export const EventTypeOutput = "o";
export const EventTypeInput = "i";
export const EventTypeResize = "r";
export const EventTypeMarker = "m";
export const EventTypeQuit = "q";

export interface Header {
  version: number;
  width: number;
  height: number;

  theme?: {
    fg?: string;
    bg?: string;
    palette?: string;
  };

  idle_time_limit?: number;
  title?: string;
}

export interface Event {
  /** time since last event in millis */
  timestamp: number;

  /** event type */
  type: string;

  /** event specific data */
  data: any;
}

// TODO write tests for this
export function parse_header_v2(input: string): Header {
  const obj = JSON.parse(input);

  return {
    version: obj.version!,
    width: obj.width!,
    height: obj.height!,

    // these are optional
    theme: obj.theme,
    idle_time_limit: obj.idle_time_limit, // TODO convert to millis as well
    title: obj.title,
  };
}

export function parse_events_v2(input: Array<string>): Array<Event> {
  let time_offset = 0;
  let events: Array<Event> = [];

  for (let i = 0; i < input.length; i++) {
    const obj = JSON.parse(input[i]);
    events.push({
      // NOTE: converting the timestamp to relative same as V3
      timestamp: (obj[0]! - time_offset) * 1000,
      type: obj[1]!,
      data: obj[2]!,
    });
    time_offset = obj[0]!;
  }

  return events;
}

/// threshold in milliseconds to add output events together
const OUTPUT_COMPRESS_THRESHOLD = 20;
function process_events(input_events: Array<Event>): Array<Event> {
  let events: Array<Event> = [input_events[0]];

  for (let i = 1; i < input_events.length; i++) {
    // if delay is less than 10ms and its output event then try to concat them
    if (input_events[i].timestamp < OUTPUT_COMPRESS_THRESHOLD && input_events[i].type == EventTypeOutput && events[events.length - 1].type == EventTypeOutput) {
      events[events.length - 1].data += input_events[i].data;
    } else {
      events.push(input_events[i]);
    }
  }

  return events;
}

export class AsciicastFile {
  header: Header;
  events: Array<Event>;

  constructor(header: Header, events: Array<Event>) {
    this.header = header;
    this.events = events;
  }

  static parse(input: string): AsciicastFile {
    // the split leaves empty strings or "\r" strings
    const lines = input.split("\n").filter((val) => {
      const trimmed = val.trim();
      // skip empty strings or comments (v3)
      if (trimmed == "" || trimmed.startsWith("#")) {
        return false;
      }

      return true;
    });

    const header_json: { version: number } = JSON.parse(lines[0]);
    let header: Header | null = null;
    let events: Array<Event> = [];

    if (header_json.version == 2) {
      header = parse_header_v2(lines[0]);
      events = parse_events_v2(lines.slice(1));
    } else {
      throw Error(`Invalid asciicast version '${header_json.version}'`);
    }

    events = process_events(events);

    return new AsciicastFile(header, events);
  }
}
