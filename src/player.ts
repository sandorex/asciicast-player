import { Terminal } from '@xterm/xterm';
import { ImageAddon } from '@xterm/addon-image';
import { FitAddon } from '@xterm/addon-fit';

import * as cast from './asciicast.ts';

export class AsciicastPlayer {
  readonly player: HTMLElement;

  /** xtermjs object */
  private terminal: Terminal;

  private fitAddon: FitAddon;

  /** which event is the next (not the current one) */
  private index: number = 0;

  private file: cast.AsciicastFile | null = null;

  // private markers: Array<number> = [];


  /** time of the final event */
  // private duration: number = 0;
  // private audio_data?: any;

  private timeout_id: number | null = null;

  /** event on start of playback (start of file) */
  on_start = (_: this) => {};

  /** event on end of playback (end of file) */
  on_end = (_: this) => {};

  /** event when marker is reached */
  on_marker = (_: this, _event_index: number) => {};

  /** event on any error */
  on_error = (_: this) => {};

  /** event on seek */
  on_seek = (_: this) => {};

  /** event on play or pause (not including start or end of file) */
  on_play_pause = (_: this) => {};

  constructor(player: HTMLElement) {
    this.player = player;

    this.terminal = new Terminal();

    const imageAddon = new ImageAddon({
      iipSupport: true,
      sixelSupport: true,
    });
    this.terminal.loadAddon(imageAddon);

    this.fitAddon = new FitAddon();
    this.terminal.loadAddon(this.fitAddon);

    this.terminal.open(this.player as HTMLElement);
  }

  private execute_event(event: cast.Event) {
    if (event.type == cast.EventTypeOutput) {
      this.terminal.write(event.data as string);
    } else if (event.type == cast.EventTypeResize) {
      const size = (event.data as string).split("x");
      const width = parseInt(size[0]);
      const height = parseInt(size[1]);

      this.terminal.resize(width, height);
    } else {
      console.log(`Ignorning event '${event.type}' at '${event.timestamp}'`);
    }
  }

  private queue_clear() {
    if (this.timeout_id) {
      clearTimeout(this.timeout_id);
      this.timeout_id = null;
    }
  }

  private queue_next() {
    if (!this.file)
      return;

    this.queue_clear();

    const event_index = this.index;
    const event = this.file!.events[event_index];

    this.timeout_id = setTimeout(() => {
      this.execute_event(event);
      this.index = event_index + 1;

      // the end of file
      if (this.index >= this.file!.events.length) {
        this.queue_clear();

        // call on_end event
        this.on_end(this);
        return;
      }

      if (this.is_playing()) {
        this.queue_next();
      }
    }, event.timestamp); // TODO clamp max wait time
  }

  is_playing() {
    return this.timeout_id != null;
  }

  play() {
    // cannot play twice or without any data
    if (this.is_playing() || !this.file) {
      return;
    }

    this.queue_next();
  }

  pause() {
    this.queue_clear();
  }

  seek(index: number) {
    if (!this.file)
      return;

    // clamp the index just in case
    if (index <= 0) {
      index = 0;
    } else if (index > this.file.events.length) {
      index = this.file.events.length;
    }

    console.log(`Seeking to index ${index}`);

    const was_playing = this.is_playing();

    // stop playback
    this.queue_clear();

    const seeking_forward = this.index < index;
    if (!seeking_forward) {
      // clear the screen only when seeking backwards
      this.terminal.clear()
    }

    // do not rerun when seeking forward
    const start = seeking_forward ? this.index : 0;

    for (let i = start; i < index; i++) {
      this.execute_event(this.file.events[i]);
    }

    // set index wanted
    this.index = index;

    // if player was playing before seek resume
    if (was_playing) {
      this.queue_next();
    }
  }

  seek_rel(index: number) {
    this.seek(this.index + index);
  }

  async load_fetch(path: RequestInfo | URL): Promise<void> {
    this.queue_clear();

    this.file = null;
    this.index = 0;

    const resp = await fetch(path);
    const text = await resp.text();

    return this.load(text);
  }

  async load(data: string): Promise<void> {
    this.file = cast.AsciicastFile.parse(data);
    this.file.events.forEach((x) => {
      console.log(x.timestamp, x.type);
    })
    this.terminal.resize(this.file.header.width, this.file.header.height);
  }
}

const elem = document.getElementById('terminal')!;
const player = new AsciicastPlayer(elem);
player.load_fetch("/iterm2.cast")
  .then(() => player.play());

document.getElementById('play')!
  .onclick = () => {
    if (player.is_playing()) {
      player.pause();
    } else {
      player.play();
    }
  };
document.getElementById('seekl')!
  .onclick = () => {
    player.seek_rel(-1);
  };
document.getElementById('seekr')!
  .onclick = () => {
    player.seek_rel(1);
  };
