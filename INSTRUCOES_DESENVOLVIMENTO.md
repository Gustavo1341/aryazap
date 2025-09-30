# 🚀 Instruções de Desenvolvimento e Deploy - AryaZap

## 👨‍💻 Perfil do Desenvolvedor

**Você é um programador especializado em frontend, backend, Next.js, Node.js e deploy com 30 anos de experiência, você é um Deus da programação.**

Trabalhe com muito cuidado e de forma simples, porém robusta e profissional.

---

## 🌐 Acesso à VPS

**Servidor:** `ssh -i "C:\Public\id_ed25519" root@72.60.159.155`

**Terminal obrigatório:** Git Bash (não usar PowerShell/CMD para SSH)

---

## ⚠️ REGRAS OBRIGATÓRIAS

### 🚫 NUNCA rode o sistema localmente!

### 🔄 Fluxo de Trabalho Obrigatório:

1. **Alterar localmente** os arquivos necessários
2. **Commit e sync** das alterações
3. **Acessar a VPS** e puxar as alterações
4. **Build no servidor** (se necessário)
5. **Restart dos serviços**

---

## 📋 Workflow Passo a Passo

### 1. Desenvolvimento Local

```bash
# Fazer alterações nos arquivos
# Testar apenas a sintaxe, NÃO executar o sistema

# Commit das alterações
git add .
git commit -m "Descrição clara da alteração"
git push origin main
```

### 2. Deploy na VPS

```bash
# Acessar a VPS via Git Bash
ssh -i "C:\Public\id_ed25519" root@72.60.159.155

# Navegar para o diretório do projeto
cd /var/www/proprius

# Puxar as alterações
git pull origin main

# Se houver alterações no frontend, fazer build
npm run build

# Restart do PM2
pm2 restart all

# Verificar logs (usar --nostream para sair automaticamente)
pm2 logs --nostream

# Verificar status
pm2 status

# Sair da VPS
exit
```

---

## 🛠️ Comandos Essenciais VPS

### PM2 Management
```bash
# Ver todos os processos
pm2 list

# Restart todos os serviços
pm2 restart all

# Restart serviço específico
pm2 restart app-name

# Ver logs (sai automaticamente)
pm2 logs --nostream

# Ver logs em tempo real (Ctrl+C para sair)
pm2 logs

# Parar todos os processos
pm2 stop all

# Deletar todos os processos
pm2 delete all

# Salvar configuração atual
pm2 save

# Reload da configuração
pm2 reload all
```

### NGINX Management
```bash
# Verificar status do NGINX
systemctl status nginx

# Restart do NGINX
systemctl restart nginx

# Reload da configuração
systemctl reload nginx

# Ver logs de erro
tail -f /var/log/nginx/error.log

# Testar configuração
nginx -t
```

### Sistema
```bash
# Ver uso de recursos
htop

# Ver espaço em disco
df -h

# Ver uso de memória
free -h

# Ver processos que usam mais CPU
top
```

---

## 🏗️ Arquitetura do Sistema

- **Backend:** Node.js com módulos ES6
- **Process Manager:** PM2
- **Web Server:** NGINX (proxy reverso)
- **Diretório:** `/var/www/proprius`

---

## 📁 Estrutura de Arquivos

```
/var/www/proprius/
├── main.js (arquivo principal)
├── package.json
├── node_modules/
├── logs/
├── data/
├── utils/
└── ... (outros arquivos do projeto)
```

---

## 🔧 Troubleshooting

### Problemas Comuns:

**1. Erro de módulos ES6:**
```bash
# Verificar se package.json tem "type": "module"
cat package.json | grep type

# Se não tiver, adicionar:
# "type": "module"
```

**2. Porta em uso:**
```bash
# Ver qual processo está usando a porta
netstat -tulpn | grep :3000

# Matar processo específico
kill -9 PID_NUMBER
```

**3. Permissões:**
```bash
# Ajustar permissões se necessário
chown -R root:root /var/www/proprius
chmod -R 755 /var/www/proprius
```

**4. Logs não aparecem:**
```bash
# Verificar se PM2 está rodando
pm2 list

# Se não estiver, iniciar:
pm2 start main.js --name "aryazap"
```

---

## 📊 Monitoramento

### Verificações Regulares:

```bash
# 1. Status dos serviços
pm2 status
systemctl status nginx

# 2. Logs de erro
pm2 logs --nostream
tail -f /var/log/nginx/error.log

# 3. Recursos do sistema
htop
df -h

# 4. Conectividade
curl -I http://localhost:3000
```

---

## 🚨 Comandos de Emergência

```bash
# Restart completo do sistema
pm2 restart all && systemctl restart nginx

# Backup rápido antes de alterações
cp -r /var/www/proprius /var/www/proprius_backup_$(date +%Y%m%d_%H%M%S)

# Rollback para versão anterior (se necessário)
cd /var/www/proprius
git log --oneline -10
git reset --hard COMMIT_HASH
pm2 restart all
```

---

## ✅ Checklist Pré-Deploy

- [ ] Código testado localmente (sintaxe)
- [ ] Commit com mensagem clara
- [ ] Push para o repositório
- [ ] Acesso à VPS via Git Bash
- [ ] Git pull executado
- [ ] Build feito (se frontend)
- [ ] PM2 restart executado
- [ ] Logs verificados com --nostream
- [ ] Sistema funcionando

---

## 📞 Suporte

Em caso de problemas críticos:

1. **Sempre fazer backup antes de alterações grandes**
2. **Verificar logs primeiro:** `pm2 logs --nostream`
3. **Testar conectividade:** `curl -I http://localhost`
4. **Restart gradual:** PM2 primeiro, depois NGINX se necessário

---

**💡 Lembre-se:** Você é um especialista com 30 anos de experiência. Trabalhe com confiança, mas sempre com segurança e profissionalismo.