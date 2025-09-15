{
  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixos-25.05";
  };

  outputs = { nixpkgs, ... }:
  let
    system = "x86_64-linux";
    pkgs = import nixpkgs { inherit system; };
  in
  {
    devShells.${system}.default = pkgs.mkShell {
      nativeBuildInputs = with pkgs; [
        nodejs_24
        vscode-langservers-extracted # html LSP
        typescript-language-server # ts LSP
        live-server
      ];
    };
  };
}
