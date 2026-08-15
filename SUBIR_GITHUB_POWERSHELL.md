# Subir para GitHub usando PowerShell

Execute os comandos abaixo dentro desta pasta:

```powershell
cd "C:\Users\comercial\Desktop\Gestão APP MHS\HANDOFF_MAPA_CLIENTES"
git init
git branch -M main
git add .
git status
git commit -m "Publica mapa de clientes MHS"
git remote add origin https://github.com/SEU_USUARIO/SEU_REPOSITORIO.git
git push -u origin main
```

Troque `SEU_USUARIO` e `SEU_REPOSITORIO` pelo seu repositorio real.

## Se o remote ja existir

```powershell
git remote set-url origin https://github.com/SEU_USUARIO/SEU_REPOSITORIO.git
git push -u origin main
```

## Conferir o que sera enviado

```powershell
git status
git ls-files
```

## Testar antes de subir

```powershell
python -m http.server 8000
```

Abra:

`http://localhost:8000/02_PROJETO_ATUAL/`

