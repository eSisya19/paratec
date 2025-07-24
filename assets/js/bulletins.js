// js/bulletins.js

window.bulletins = {
    html: `
        <div class="card">
            <div class="card-header" style="display:flex; justify-content:space-between; align-items:center;">
                <h2>Company Bulletins</h2>
                <button id="send-bulletin-btn" class="btn hidden">Send New Bulletin</button>
            </div>
            <div id="bulletins-list" class="bulletins-container">
                <p>Loading bulletins...</p>
            </div>
        </div>
    `,

    loadedBulletins: [],
    readStatuses: new Set(),

    init: function() {
        if (app.currentUser.role === 'Admin') {
            document.getElementById('send-bulletin-btn').classList.remove('hidden');
            document.getElementById('send-bulletin-btn').addEventListener('click', () => this.showSendModal());
        }
        this.loadBulletins();

        document.getElementById('bulletins-list').addEventListener('click', (e) => {
            const bulletinItem = e.target.closest('.bulletin-item');
            if (bulletinItem) {
                const bulletinId = bulletinItem.dataset.id;
                this.showBulletinDetail(bulletinId);
            }
        });
    },

    loadBulletins: async function() {
        const container = document.getElementById('bulletins-list');
        container.innerHTML = '<p>Loading bulletins...</p>';
        try {
            const { data: bulletins, error: bulletinsError } = await client
                .from('bulletins')
                .select('*, author:users!bulletins_author_id_fkey(full_name)')
                .order('created_at', { ascending: false });
            if (bulletinsError) throw bulletinsError;
            this.loadedBulletins = bulletins;

            if (app.currentUser.role === 'Employee') {
                const { data: reads, error: readsError } = await client
                    .from('bulletin_reads')
                    .select('bulletin_id')
                    .eq('user_id', app.currentUser.id);
                if (readsError) throw readsError;
                this.readStatuses = new Set(reads.map(r => r.bulletin_id));
            }
            this.renderBulletins();
        } catch (error) {
            console.error("Error loading bulletins:", error);
            app.showToast('Could not load bulletins.', 'error');
            container.innerHTML = '<p>Error loading bulletins. Please try again.</p>';
        }
    },

    renderBulletins: function() {
        // ... (This function remains unchanged)
    },

    // ===================================================================
    // MODAL AND DETAIL VIEW (Main changes are here)
    // ===================================================================
    showBulletinDetail: async function(bulletinId) {
        const bulletin = this.loadedBulletins.find(b => b.id === bulletinId);
        if (!bulletin) return;
        
        // THE FIX: Conditionally add the "Read Receipts" section only for Admins.
        const adminReadReceiptsHtml = app.currentUser.role === 'Admin' ? `
            <hr>
            <h4>Read Receipts</h4>
            <div id="bulletin-read-receipts" style="max-height: 150px; overflow-y: auto; margin-bottom: 15px;">
                <p>Loading read receipts...</p>
            </div>
        ` : '';

        const detailContent = `
            <div class="bulletin-detail-content">
                ${bulletin.content.replace(/\n/g, '<br>')}
            </div>
            ${adminReadReceiptsHtml}
            <hr>
            <h4>Comments</h4>
            <div id="bulletin-comments-list" style="max-height: 200px; overflow-y: auto; margin-bottom: 15px;">
                <p>Loading comments...</p>
            </div>
            <div id="bulletin-add-comment">
                <textarea id="new-comment-text" class="form-control" rows="2" placeholder="Write a comment..."></textarea>
                <button id="submit-comment-btn" class="btn btn-small" style="margin-top: 5px;">Post Comment</button>
            </div>
        `;

        app.showModal(bulletin.title, detailContent);
        
        // Load data for the modal
        this.loadComments(bulletinId);
        document.getElementById('submit-comment-btn').addEventListener('click', () => this.postComment(bulletinId));

        // THE FIX: Call the new function to load read receipts if the user is an Admin
        if (app.currentUser.role === 'Admin') {
            this.loadReadReceipts(bulletinId);
        }

        // Mark as read logic for Employees
        if (app.currentUser.role === 'Employee' && !this.readStatuses.has(bulletin.id)) {
            this.markAsRead(bulletin.id);
        }
    },
    
    // THE FIX: New function to load the list of users who read the bulletin.
    loadReadReceipts: async function(bulletinId) {
        const receiptsContainer = document.getElementById('bulletin-read-receipts');
        try {
            const { data: receipts, error } = await client
                .from('bulletin_reads')
                .select('read_at, reader:users(full_name)')
                .eq('bulletin_id', bulletinId)
                .order('read_at', { ascending: true });
            
            if (error) throw error;
            
            if (receipts.length === 0) {
                receiptsContainer.innerHTML = '<p>No one has read this bulletin yet.</p>';
                return;
            }
            receiptsContainer.innerHTML = receipts.map(receipt => `
                <div class="receipt-item">
                    <span>${receipt.reader.full_name}</span>
                    <small>Read on ${new Date(receipt.read_at).toLocaleString()}</small>
                </div>
            `).join('');

        } catch (error) {
            console.error("Error loading read receipts:", error);
            receiptsContainer.innerHTML = '<p>Could not load read receipts.</p>';
        }
    },

    markAsRead: async function(bulletinId) {
        // ... (This function remains unchanged)
    },
    
    loadComments: async function(bulletinId) {
        // ... (This function remains unchanged)
    },
    
    postComment: async function(bulletinId) {
        // ... (This function remains unchanged)
    },
    
    // ===================================================================
    // ADMIN FUNCTIONS
    // ===================================================================
    showSendModal: function() {
        // ... (This function remains unchanged)
    },
    
    handleSendBulletin: async function() {
        // ... (This function remains unchanged)
    }
};

// I am providing the full file below for copy-pasting convenience.
// All unchanged functions are included.
window.bulletins.renderBulletins = function() {
    const container = document.getElementById('bulletins-list');
    if (this.loadedBulletins.length === 0) {
        container.innerHTML = '<p>No bulletins have been sent yet.</p>';
        return;
    }
    container.innerHTML = this.loadedBulletins.map(bulletin => {
        const isRead = this.readStatuses.has(bulletin.id);
        const authorName = bulletin.author ? bulletin.author.full_name : 'System';
        const createdDate = new Date(bulletin.created_at).toLocaleDateString();
        return `<div class="bulletin-item ${isRead ? 'read' : 'unread'}" data-id="${bulletin.id}"><div class="bulletin-status-icon">${isRead ? '<i class="fa-solid fa-envelope-open"></i>' : '<i class="fa-solid fa-envelope"></i>'}</div><div class="bulletin-content"><h4>${bulletin.title}</h4><p>Sent by ${authorName} on ${createdDate}</p></div><div class="bulletin-read-status">${!isRead && app.currentUser.role === 'Employee' ? '<span class="status new-badge">New</span>' : ''}</div></div>`;
    }).join('');
};
window.bulletins.markAsRead = async function(bulletinId) {
    try {
        await client.from('bulletin_reads').upsert({ bulletin_id: bulletinId, user_id: app.currentUser.id });
        this.readStatuses.add(bulletinId);
        this.renderBulletins();
    } catch (error) { console.error('Failed to mark as read:', error); }
};
window.bulletins.loadComments = async function(bulletinId) {
    const commentsContainer = document.getElementById('bulletin-comments-list');
    try {
        const { data: comments, error } = await client.from('comments').select('*, commenter:users!comments_user_id_fkey(full_name)').eq('bulletin_id', bulletinId).order('created_at', { ascending: true });
        if (error) throw error;
        if (comments.length === 0) {
            commentsContainer.innerHTML = '<p>No comments yet. Be the first to comment!</p>';
            return;
        }
        commentsContainer.innerHTML = comments.map(comment => `<div class="comment-item"><strong>${comment.commenter ? comment.commenter.full_name : 'A User'}:</strong><p>${comment.content}</p><small>${new Date(comment.created_at).toLocaleString()}</small></div>`).join('');
    } catch (error) {
        console.error("Error loading comments:", error);
        commentsContainer.innerHTML = '<p>Could not load comments.</p>';
    }
};
window.bulletins.postComment = async function(bulletinId) {
    const commentInput = document.getElementById('new-comment-text');
    const commentText = commentInput.value;
    if (!commentText.trim()) return;
    try {
        await client.from('comments').insert({ bulletin_id: bulletinId, user_id: app.currentUser.id, content: commentText });
        commentInput.value = '';
        this.loadComments(bulletinId);
    } catch (error) { app.showToast('Failed to post comment.', 'error'); }
};
window.bulletins.showSendModal = function() {
    const formHtml = `<form id="new-bulletin-form"><label for="bulletin-title">Title:</label><input type="text" id="bulletin-title" required><label for="bulletin-content">Content (supports line breaks):</label><textarea id="bulletin-content" rows="8" required></textarea></form>`;
    app.showModal('Send New Bulletin', formHtml, { onSave: () => this.handleSendBulletin(), saveText: 'Send' });
};
window.bulletins.handleSendBulletin = async function() {
    const title = document.getElementById('bulletin-title').value;
    const content = document.getElementById('bulletin-content').value;
    if (!title.trim() || !content.trim()) { app.showToast('Title and content are required.', 'error'); return; }
    try {
        await client.from('bulletins').insert({ title, content, author_id: app.currentUser.id });
        app.showToast('Bulletin sent successfully!');
        app.hideModal();
        this.loadBulletins();
    } catch (error) { app.showToast('Failed to send bulletin.', 'error'); }
};